use std::process::Command as StdCommand;
use std::sync::Mutex;
use std::path::PathBuf;
use std::io::Write;
use tauri::{AppHandle, Emitter, Manager};

struct BackendChild(Mutex<Option<std::process::Child>>);

#[tauri::command]
fn get_backend_url() -> String {
    "http://localhost:43101".to_string()
}

#[tauri::command]
fn get_app_data_dir(app: AppHandle) -> Result<String, String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

fn log_to_file(msg: &str) {
    let home = std::env::var("HOME").unwrap_or_default();
    let log_path = format!("{}/Library/Logs/AgentOSBrain.log", home);
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&log_path) {
        let _ = writeln!(f, "[{}] {}", chrono_now(), msg);
    }
    eprintln!("{}", msg);
}

fn chrono_now() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}", now)
}

/// Find the resource directory where our bundled files live
fn find_resource_dir(app: &AppHandle) -> Option<PathBuf> {
    // Inside .app bundle: Contents/Resources/
    if let Ok(resource_path) = app.path().resource_dir() {
        log_to_file(&format!("Resource dir: {:?}", resource_path));

        if resource_path.join("bin").join("backend-bundle.cjs").exists() {
            return Some(resource_path.join("bin"));
        }
        if resource_path.join("backend-bundle.cjs").exists() {
            return Some(resource_path.clone());
        }

        // List what's actually in resources
        if let Ok(entries) = std::fs::read_dir(&resource_path) {
            for entry in entries.flatten() {
                log_to_file(&format!("  resource: {:?}", entry.path()));
            }
        }
    }

    // Development fallback
    let dev_bin = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin");
    if dev_bin.join("backend-bundle.cjs").exists() {
        return Some(dev_bin);
    }

    None
}

/// Find a working Node.js binary
fn find_node(resource_dir: &PathBuf) -> Option<PathBuf> {
    let bundled = resource_dir.join("node");
    if bundled.exists() {
        return Some(bundled);
    }

    let candidates = [
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        "/usr/bin/node",
    ];
    for path in candidates {
        let p = PathBuf::from(path);
        if p.exists() {
            return Some(p);
        }
    }

    if let Ok(output) = StdCommand::new("which").arg("node").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(PathBuf::from(path));
            }
        }
    }

    None
}

fn start_backend(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_data = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_data)?;

    let db_path = app_data.join("agenteos.db");
    let outputs_dir = app_data.join("outputs");
    std::fs::create_dir_all(&outputs_dir)?;

    let resource_dir = find_resource_dir(app)
        .ok_or("Cannot find backend bundle — resources directory not found")?;

    let bundle_path = resource_dir.join("backend-bundle.cjs");
    if !bundle_path.exists() {
        return Err(format!("Backend bundle not found at: {:?}", bundle_path).into());
    }

    let node_path = find_node(&resource_dir)
        .ok_or("Node.js not found — install Node.js 18+ from https://nodejs.org/")?;

    log_to_file(&format!("Node.js: {:?}", node_path));
    log_to_file(&format!("Bundle: {:?}", bundle_path));
    log_to_file(&format!("Data: {:?}", app_data));

    let node_path_env = format!(
        "{}:{}",
        resource_dir.to_string_lossy(),
        resource_dir.join("build").join("Release").to_string_lossy()
    );

    let child = StdCommand::new(&node_path)
        .arg(&bundle_path)
        .env("PORT", "43101")
        .env("NODE_ENV", "production")
        .env("AGENT_OS_DB_PATH", db_path.to_string_lossy().to_string())
        .env("AGENT_OS_OUTPUTS_DIR", outputs_dir.to_string_lossy().to_string())
        .env("AGENT_OS_DATA_DIR", app_data.to_string_lossy().to_string())
        .env("NODE_PATH", &node_path_env)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn Node.js backend: {}", e))?;

    log_to_file(&format!("Backend started (pid: {})", child.id()));

    let state = app.state::<BackendChild>();
    *state.0.lock().unwrap() = Some(child);

    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        let _ = handle.emit("backend-ready", true);
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    log_to_file("=== Agent OS Brain starting ===");

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(BackendChild(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![get_backend_url, get_app_data_dir])
        .setup(|app| {
            log_to_file("Setup starting...");
            let handle = app.handle().clone();

            match start_backend(&handle) {
                Ok(()) => log_to_file("Backend started on port 43101"),
                Err(e) => {
                    log_to_file(&format!("Backend failed: {}", e));
                    let _ = handle.emit("backend-error", e.to_string());
                }
            }

            log_to_file("Setup complete");
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle();
                let state = app.state::<BackendChild>();
                let mut guard = state.0.lock().unwrap();
                if let Some(mut child) = guard.take() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        });

    log_to_file("Builder created, calling run()...");

    match builder.run(tauri::generate_context!()) {
        Ok(()) => {},
        Err(e) => {
            log_to_file(&format!("FATAL: Tauri run() failed: {}", e));
            // Try to show a native dialog
            let msg = format!("Agent OS Brain non puo partire:\n\n{}\n\nControlla ~/Library/Logs/AgentOSBrain.log", e);
            let _ = StdCommand::new("osascript")
                .arg("-e")
                .arg(format!("display dialog \"{}\" buttons {{\"OK\"}} with icon stop", msg))
                .output();
        }
    }
}
