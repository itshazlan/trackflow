use keyring::{Entry, Error};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn save_token(token: &str) -> Result<(), String> {
    let entry = Entry::new("trackflow", "auth_token").map_err(|e| e.to_string())?;
    entry.set_password(token).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_token() -> Result<String, String> {
    let entry = Entry::new("trackflow", "auth_token").map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(password) => Ok(password),
        Err(Error::NoEntry) => Ok(String::new()), // Return empty string if no token exists
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn delete_token() -> Result<(), String> {
    let entry = Entry::new("trackflow", "auth_token").map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(Error::NoEntry) => Ok(()), // If it's already deleted/not there, count as success
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            save_token,
            get_token,
            delete_token
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

