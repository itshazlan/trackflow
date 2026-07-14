use keyring::{Entry, Error};
use std::sync::Mutex;
use std::path::PathBuf;
use rusqlite::Connection;
use tauri::Manager;

#[derive(Default)]
pub struct ActiveTrackingState {
    pub project_id: Mutex<Option<String>>,
    pub issue_id: Mutex<Option<String>>,
}

#[derive(Default)]
pub struct ActiveTimerState {
    pub status: Mutex<String>, // "Idle", "Running", "Paused"
    pub start_time: Mutex<Option<i64>>, // Unix timestamp of session start
    pub current_block_start: Mutex<Option<i64>>, // Unix timestamp of current 10s block start
    pub accumulated_seconds: Mutex<u64>, // Accumulated seconds from previous periods
    pub abort_handle: Mutex<Option<tokio::task::AbortHandle>>,
}

pub struct DbState {
    pub db_path: PathBuf,
}

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
    println!("[Tauri Rust] save_token successfully stored token in keyring");
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

fn commit_block_to_db(
    db_path: &std::path::Path,
    project_id: &str,
    issue_id: &str,
    block_start: i64,
    block_end: i64,
) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO time_blocks (id, project_id, issue_id, block_start, block_end, synced)
         VALUES (lower(hex(randomblob(16))), ?1, ?2, ?3, ?4, 0)",
        [
            project_id.to_string(),
            issue_id.to_string(),
            block_start.to_string(),
            block_end.to_string(),
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

fn start_background_tick_loop(
    app_handle: tauri::AppHandle,
    project_id: String,
    issue_id: String,
    db_path: PathBuf,
) -> tokio::task::AbortHandle {
    let task = tokio::spawn(async move {
        // Every 10 seconds for testing (production is 10 minutes)
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(10));
        // First tick resolves instantly, skip it
        interval.tick().await;

        loop {
            interval.tick().await;
            let now = chrono::Utc::now().timestamp();
            
            let timer_state = app_handle.state::<ActiveTimerState>();
            
            let block_start = {
                let mut curr = timer_state.current_block_start.lock().unwrap();
                let start = curr.unwrap_or(now - 10);
                *curr = Some(now);
                start
            };

            if let Err(e) = commit_block_to_db(&db_path, &project_id, &issue_id, block_start, now) {
                println!("[Tauri Rust] Error committing time block: {}", e);
            } else {
                println!(
                    "[Tauri Rust] Committed 10s tick block: Proj={}, Issue={}, Start={}, End={}",
                    project_id, issue_id, block_start, now
                );
            }
        }
    });

    task.abort_handle()
}

#[tauri::command]
async fn start_timer(
    app_handle: tauri::AppHandle,
    tracking_state: tauri::State<'_, ActiveTrackingState>,
    timer_state: tauri::State<'_, ActiveTimerState>,
    db_state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let mut status = timer_state.status.lock().unwrap();
    if *status == "Running" {
        return Err("Timer is already running".to_string());
    }

    let project_id = tracking_state.project_id.lock().unwrap().clone()
        .ok_or_else(|| "No project selected".to_string())?;
    let issue_id = tracking_state.issue_id.lock().unwrap().clone()
        .ok_or_else(|| "No task selected".to_string())?;

    let now = chrono::Utc::now().timestamp();

    let mut start_time = timer_state.start_time.lock().unwrap();
    if start_time.is_none() {
        *start_time = Some(now);
    }

    let mut current_block_start = timer_state.current_block_start.lock().unwrap();
    *current_block_start = Some(now);

    *status = "Running".to_string();

    let handle = start_background_tick_loop(
        app_handle,
        project_id,
        issue_id,
        db_state.db_path.clone(),
    );

    *timer_state.abort_handle.lock().unwrap() = Some(handle);

    println!("[Tauri Rust] Timer started at Unix time {}", now);
    Ok(())
}

#[tauri::command]
async fn pause_timer(
    tracking_state: tauri::State<'_, ActiveTrackingState>,
    timer_state: tauri::State<'_, ActiveTimerState>,
    db_state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let mut status = timer_state.status.lock().unwrap();
    if *status != "Running" {
        return Err("Timer is not running".to_string());
    }

    let now = chrono::Utc::now().timestamp();

    if let Some(handle) = timer_state.abort_handle.lock().unwrap().take() {
        handle.abort();
    }

    let project_id = tracking_state.project_id.lock().unwrap().clone()
        .ok_or_else(|| "No project selected".to_string())?;
    let issue_id = tracking_state.issue_id.lock().unwrap().clone()
        .ok_or_else(|| "No task selected".to_string())?;

    let mut current_block_start = timer_state.current_block_start.lock().unwrap();
    if let Some(start) = current_block_start.take() {
        if now > start {
            if let Err(e) = commit_block_to_db(&db_state.db_path, &project_id, &issue_id, start, now) {
                println!("[Tauri Rust] Error committing partial block on pause: {}", e);
            } else {
                println!("[Tauri Rust] Committed partial block on pause ({}s)", now - start);
            }

            let mut accumulated = timer_state.accumulated_seconds.lock().unwrap();
            *accumulated += (now - start) as u64;
        }
    }

    *status = "Paused".to_string();
    println!("[Tauri Rust] Timer paused");
    Ok(())
}

#[tauri::command]
async fn stop_timer(
    tracking_state: tauri::State<'_, ActiveTrackingState>,
    timer_state: tauri::State<'_, ActiveTimerState>,
    db_state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let mut status = timer_state.status.lock().unwrap();
    if *status == "Idle" {
        return Ok(());
    }

    let now = chrono::Utc::now().timestamp();

    if let Some(handle) = timer_state.abort_handle.lock().unwrap().take() {
        handle.abort();
    }

    if *status == "Running" {
        let project_id = tracking_state.project_id.lock().unwrap().clone()
            .ok_or_else(|| "No project selected".to_string())?;
        let issue_id = tracking_state.issue_id.lock().unwrap().clone()
            .ok_or_else(|| "No task selected".to_string())?;

        let mut current_block_start = timer_state.current_block_start.lock().unwrap();
        if let Some(start) = current_block_start.take() {
            if now > start {
                if let Err(e) = commit_block_to_db(&db_state.db_path, &project_id, &issue_id, start, now) {
                    println!("[Tauri Rust] Error committing final partial block on stop: {}", e);
                } else {
                    println!("[Tauri Rust] Committed final partial block on stop ({}s)", now - start);
                }
            }
        }
    } else {
        let mut current_block_start = timer_state.current_block_start.lock().unwrap();
        *current_block_start = None;
    }

    *timer_state.start_time.lock().unwrap() = None;
    *timer_state.accumulated_seconds.lock().unwrap() = 0;
    *status = "Idle".to_string();

    println!("[Tauri Rust] Timer stopped and reset");
    Ok(())
}

#[derive(serde::Serialize)]
struct TimerStatePayload {
    status: String,
    start_time: Option<i64>,
    accumulated_seconds: u64,
}

#[tauri::command]
async fn get_timer_state(
    timer_state: tauri::State<'_, ActiveTimerState>,
) -> Result<TimerStatePayload, String> {
    let status = timer_state.status.lock().unwrap().clone();
    let start_time = *timer_state.start_time.lock().unwrap();
    let accumulated_seconds = *timer_state.accumulated_seconds.lock().unwrap();

    Ok(TimerStatePayload {
        status,
        start_time,
        accumulated_seconds,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ActiveTrackingState::default())
        .manage(ActiveTimerState::default())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().unwrap();
            std::fs::create_dir_all(&app_data_dir).unwrap();
            let db_path = app_data_dir.join("trackflow_local.db");
            
            // Initialize table
            let conn = rusqlite::Connection::open(&db_path).unwrap();
            conn.execute(
                "CREATE TABLE IF NOT EXISTS time_blocks (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    issue_id TEXT NOT NULL,
                    block_start TEXT NOT NULL,
                    block_end TEXT NOT NULL,
                    synced INTEGER NOT NULL DEFAULT 0
                )",
                [],
            ).unwrap();
            
            app.manage(DbState { db_path });
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            save_token,
            get_token,
            delete_token,
            set_active_task,
            get_active_task,
            start_timer,
            pause_timer,
            stop_timer,
            get_timer_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
