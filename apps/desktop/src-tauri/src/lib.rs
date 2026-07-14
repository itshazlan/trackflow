use keyring::{Entry, Error};
use std::sync::Mutex;

#[derive(Default)]
pub struct ActiveTrackingState {
    pub project_id: Mutex<Option<String>>,
    pub issue_id: Mutex<Option<String>>,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn save_token(token: &str) -> Result<(), String> {
    println!("[Tauri Rust] save_token called");
    let entry = Entry::new("trackflow", "auth_token").map_err(|e| {
        println!("[Tauri Rust] save_token Entry::new error: {}", e);
        e.to_string()
    })?;
    entry.set_password(token).map_err(|e| {
        println!("[Tauri Rust] save_token set_password error: {}", e);
        e.to_string()
    })?;
    println!("[Tauri Rust] save_token successfully stored token");
    Ok(())
}

#[tauri::command]
fn get_token() -> Result<String, String> {
    println!("[Tauri Rust] get_token called");
    let entry = Entry::new("trackflow", "auth_token").map_err(|e| {
        println!("[Tauri Rust] get_token Entry::new error: {}", e);
        e.to_string()
    })?;
    match entry.get_password() {
        Ok(password) => {
            println!("[Tauri Rust] get_token successfully retrieved token");
            Ok(password)
        }
        Err(Error::NoEntry) => {
            println!("[Tauri Rust] get_token: no token stored in keyring");
            Ok(String::new())
        }
        Err(e) => {
            println!("[Tauri Rust] get_token keyring error: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
fn delete_token() -> Result<(), String> {
    println!("[Tauri Rust] delete_token called");
    let entry = Entry::new("trackflow", "auth_token").map_err(|e| {
        println!("[Tauri Rust] delete_token Entry::new error: {}", e);
        e.to_string()
    })?;
    match entry.delete_credential() {
        Ok(_) => {
            println!("[Tauri Rust] delete_token successfully deleted token");
            Ok(())
        }
        Err(Error::NoEntry) => {
            println!("[Tauri Rust] delete_token: token was already deleted or not present");
            Ok(())
        }
        Err(e) => {
            println!("[Tauri Rust] delete_token keyring error: {}", e);
            Err(e.to_string())
        }
    }
}
#[tauri::command]
fn set_active_task(
    project_id: Option<String>,
    issue_id: Option<String>,
    state: tauri::State<'_, ActiveTrackingState>,
) -> Result<(), String> {
    *state.project_id.lock().unwrap() = project_id.clone();
    *state.issue_id.lock().unwrap() = issue_id.clone();
    println!(
        "[Tauri Rust] set_active_task called. Project: {:?}, Issue: {:?}",
        project_id, issue_id
    );
    Ok(())
}

#[tauri::command]
fn get_active_task(
    state: tauri::State<'_, ActiveTrackingState>,
) -> Result<(Option<String>, Option<String>), String> {
    let project_id = state.project_id.lock().unwrap().clone();
    let issue_id = state.issue_id.lock().unwrap().clone();
    Ok((project_id, issue_id))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ActiveTrackingState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            save_token,
            get_token,
            delete_token,
            set_active_task,
            get_active_task
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

