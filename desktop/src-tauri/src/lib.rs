use std::process::Command as StdCommand;
use std::sync::Mutex;
use std::path::PathBuf;
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

/// Find the resource directory where our bundled files live
fn find_resource_dir(app: &AppHandle) -> Option<PathBuf> {
    // Inside .app bundle: Contents/Resources/
    if let Ok(resource_path) = app.path().resource_dir() {
        if resource_path.join("bin").join("backend-bundle.cjs").exists() {
            return Some(resource_path.join("bin"));
        }
        // Sometimes resources are directly in resource_dir
        if resource_path.join("backend-bundle.cjs").exists() {
            return Some(resource_path.clone());
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
    // 1. Bundled node inside the app
    let bundled = resource_dir.join("node");
    if bundled.exists() {
        return Some(bundled);
    }

    // 2. System node via common paths
    let candidates = vec![
        "/usr/local/bin/node",
        "/opt/homebrew/bin/node",
        "/usr/bin/node",
    ];

    for path in candidates {
        let p = PathBuf::from(path);
        if p.exists() {
            return Some(p);
        }
    }

    // 3. Try PATH
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

    println!("[AgentOS] Node.js: {:?}", node_path);
    println!("[AgentOS] Bundle: {:?}", bundle_path);
    println!("[AgentOS] Data: {:?}", app_data);

    // Set up native module path for better-sqlite3
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

    println!("[AgentOS] Backend started (pid: {})", child.id());

    let state = app.state::<BackendChild>();
    *state.0.lock().unwrap() = Some(child);

    // Emit ready after a short delay (backend needs time to start)
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        let _ = handle.emit("backend-ready", true);
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(BackendChild(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![get_backend_url, get_app_data_dir])
        .setup(|app| {
            let handle = app.handle().clone();

            match start_backend(&handle) {
                Ok(()) => println!("[AgentOS] Backend sidecar started on port 43101"),
                Err(e) => {
                    eprintln!("[AgentOS] Failed to start backend: {}", e);
                    // Don't crash — show the window anyway with an error
                    let _ = handle.emit("backend-error", e.to_string());
                }
            }

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
                    println!("[AgentOS] Backend process killed");
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Agent OS Brain");
}
