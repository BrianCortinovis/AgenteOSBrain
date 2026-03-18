use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};

struct BackendProcess(Mutex<Option<CommandChild>>);

#[tauri::command]
fn get_backend_url() -> String {
    "http://localhost:43101".to_string()
}

#[tauri::command]
fn get_app_data_dir(app: AppHandle) -> Result<String, String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

fn start_backend(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_data = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_data)?;

    let db_path = app_data.join("agenteos.db");
    let outputs_dir = app_data.join("outputs");
    std::fs::create_dir_all(&outputs_dir)?;

    let sidecar = app.shell()
        .sidecar("agenteos-backend")
        .map_err(|e| format!("Failed to create sidecar: {}", e))?
        .env("PORT", "43101")
        .env("AGENT_OS_DB_PATH", db_path.to_string_lossy().to_string())
        .env("AGENT_OS_OUTPUTS_DIR", outputs_dir.to_string_lossy().to_string())
        .env("AGENT_OS_DATA_DIR", app_data.to_string_lossy().to_string());

    let (mut rx, child) = sidecar.spawn()
        .map_err(|e| format!("Failed to spawn backend: {}", e))?;

    // Store the child process
    let state = app.state::<BackendProcess>();
    *state.0.lock().unwrap() = Some(child);

    // Log backend output
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line);
                    println!("[backend] {}", text);
                    if text.contains("Server running") || text.contains("listening") {
                        let _ = app_handle.emit("backend-ready", true);
                    }
                }
                CommandEvent::Stderr(line) => {
                    eprintln!("[backend:err] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Terminated(status) => {
                    eprintln!("[backend] Process terminated with: {:?}", status);
                    let _ = app_handle.emit("backend-terminated", true);
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(BackendProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![get_backend_url, get_app_data_dir])
        .setup(|app| {
            let handle = app.handle().clone();

            if let Err(e) = start_backend(&handle) {
                eprintln!("Failed to start backend: {}", e);
            } else {
                println!("Backend sidecar started on port 43101");
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle();
                let state = app.state::<BackendProcess>();
                let mut guard = state.0.lock().unwrap();
                if let Some(child) = guard.take() {
                    let _ = child.kill();
                    println!("Backend process killed");
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Agent OS Brain");
}
