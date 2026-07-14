use keyring::{Entry, Error};

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

