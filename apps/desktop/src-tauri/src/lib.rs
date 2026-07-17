use keyring::{Entry, Error};
use std::sync::Mutex;
use std::sync::atomic::{AtomicU32, AtomicBool, Ordering};
use std::path::PathBuf;
use rusqlite::{Connection, params};
use tauri::Manager;
use tauri::Emitter;

static ALLOW_REAL_EXIT: AtomicBool = AtomicBool::new(false);

// Global Atomic Event Counters for OS Input Hook (Keyboard / Mouse)
static KEYBOARD_COUNT: AtomicU32 = AtomicU32::new(0);
static MOUSE_COUNT: AtomicU32 = AtomicU32::new(0);

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    // FFI to check macOS accessibility permissions programmatically
    fn AXIsProcessTrusted() -> u8;
}

#[cfg(target_os = "macos")]
fn check_macos_permission() -> bool {
    unsafe { AXIsProcessTrusted() != 0 }
}

#[cfg(not(target_os = "macos"))]
fn check_macos_permission() -> bool {
    true
}

#[tauri::command]
fn check_input_permission() -> Result<bool, String> {
    Ok(check_macos_permission())
}

#[derive(Default)]
pub struct ActiveTrackingState {
    pub project_id: Mutex<Option<String>>,
    pub issue_id: Mutex<Option<String>>,
    pub issue_title: Mutex<Option<String>>,
}

pub struct AppState {
    pub is_quitting: Mutex<bool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            is_quitting: Mutex::new(false),
        }
    }
}

#[derive(Clone, serde::Serialize)]
pub struct PendingReviewData {
    pub id: String,
    pub screenshot_path: String,
}

pub struct PendingReviewState {
    pub data: Mutex<Option<PendingReviewData>>,
    pub preview_path: Mutex<Option<String>>,
    pub countdown_abort_handle: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
    pub remaining_seconds: std::sync::atomic::AtomicI32,
}

impl Default for PendingReviewState {
    fn default() -> Self {
        Self {
            data: Mutex::new(None),
            preview_path: Mutex::new(None),
            countdown_abort_handle: Mutex::new(None),
            remaining_seconds: std::sync::atomic::AtomicI32::new(15),
        }
    }
}


pub struct ScreenshotData {
    pub screenshot_path: String,
    pub active_window_title: String,
    pub active_app_name: String,
}

pub struct ActiveTimerState {
    pub status: Mutex<String>, // "Idle", "Running", "Paused"
    pub start_time: Mutex<Option<i64>>, // Unix timestamp of session start
    pub current_block_start: Mutex<Option<i64>>, // Unix timestamp of current 10s block start
    pub accumulated_seconds: Mutex<u64>, // Accumulated seconds from previous periods
    pub abort_handle: Mutex<Option<tokio::task::AbortHandle>>,
    
    // Screenshot random scheduler states
    pub screenshot_abort_handle: Mutex<Option<tokio::task::AbortHandle>>,
    pub current_screenshot: std::sync::Arc<Mutex<Option<ScreenshotData>>>,
}

impl Default for ActiveTimerState {
    fn default() -> Self {
        Self {
            status: Mutex::new("Idle".to_string()),
            start_time: Mutex::new(None),
            current_block_start: Mutex::new(None),
            accumulated_seconds: Mutex::new(0),
            abort_handle: Mutex::new(None),
            screenshot_abort_handle: Mutex::new(None),
            current_screenshot: std::sync::Arc::new(Mutex::new(None)),
        }
    }
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
    let entry = Entry::new("trackflow", "auth_token").map_err(|e| {
        e.to_string()
    })?;
    match entry.get_password() {
        Ok(password) => {
            Ok(password)
        }
        Err(Error::NoEntry) => {
            Ok(String::new())
        }
        Err(e) => {
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
    issue_title: Option<String>,
    state: tauri::State<'_, ActiveTrackingState>,
) -> Result<(), String> {
    *state.project_id.lock().unwrap() = project_id.clone();
    *state.issue_id.lock().unwrap() = issue_id.clone();
    *state.issue_title.lock().unwrap() = issue_title.clone();
    println!(
        "[Tauri Rust] set_active_task called. Project: {:?}, Issue: {:?}, Title: {:?}",
        project_id, issue_id, issue_title
    );
    Ok(())
}

#[tauri::command]
fn get_active_task(
    state: tauri::State<'_, ActiveTrackingState>,
) -> Result<(Option<String>, Option<String>, Option<String>), String> {
    let project_id = state.project_id.lock().unwrap().clone();
    let issue_id = state.issue_id.lock().unwrap().clone();
    let issue_title = state.issue_title.lock().unwrap().clone();
    Ok((project_id, issue_id, issue_title))
}

fn classify_activity(keyboard: u32, mouse: u32) -> &'static str {
    let total = keyboard + mouse;
    if total == 0 {
        "none"
    } else if total <= 20 {
        "low"
    } else if total <= 100 {
        "medium"
    } else {
        "high"
    }
}

fn commit_block_to_db(
    db_path: &std::path::Path,
    project_id: &str,
    issue_id: &str,
    block_start: i64,
    block_end: i64,
    keyboard_count: u32,
    mouse_count: u32,
    activity_level: &str,
    screenshot_path: Option<&str>,
    active_window_title: Option<&str>,
    active_app_name: Option<&str>,
    review_pending: i32,
) -> Result<String, String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    let id: String = conn.query_row(
        "INSERT INTO time_blocks (id, project_id, issue_id, block_start, block_end, keyboard_count, mouse_count, activity_level, screenshot_path, active_window_title, active_app_name, synced, review_pending)
         VALUES (lower(hex(randomblob(16))), ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0, ?11)
         RETURNING id",
        params![
            project_id,
            issue_id,
            block_start.to_string(),
            block_end.to_string(),
            keyboard_count,
            mouse_count,
            activity_level,
            screenshot_path,
            active_window_title,
            active_app_name,
            review_pending,
        ],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

fn input_callback(event: rdev::Event) {
    match event.event_type {
        rdev::EventType::KeyPress(_) => {
            KEYBOARD_COUNT.fetch_add(1, Ordering::SeqCst);
        }
        rdev::EventType::ButtonPress(_) | rdev::EventType::MouseMove { .. } | rdev::EventType::Wheel { .. } => {
            MOUSE_COUNT.fetch_add(1, Ordering::SeqCst);
        }
        _ => {}
    }
}

#[cfg(target_os = "macos")]
fn play_shutter_sound() {
    let _ = std::process::Command::new("afplay")
        .arg("/System/Library/Sounds/Tink.aiff")
        .spawn();
}

#[cfg(not(target_os = "macos"))]
fn play_shutter_sound() {}

fn get_current_active_window() -> (String, String) {
    use active_win_pos_rs::get_active_window;
    match get_active_window() {
        Ok(win) => {
            let title = if win.title.trim().is_empty() { "Unknown".to_string() } else { win.title };
            let app = if win.app_name.trim().is_empty() { "Unknown".to_string() } else { win.app_name };
            (title, app)
        }
        Err(_) => ("Unknown".to_string(), "Unknown".to_string()),
    }
}

fn capture_and_save_screenshot(app_handle: &tauri::AppHandle) -> Result<ScreenshotData, String> {
    use xcap::Monitor;

    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let screenshots_dir = app_data_dir.join("screenshots");
    std::fs::create_dir_all(&screenshots_dir).map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().timestamp();
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    
    let mut saved_paths = Vec::new();
    for (index, monitor) in monitors.iter().enumerate() {
        let image = monitor.capture_image().map_err(|e| e.to_string())?;
        let filename = format!("screenshot_{}_{}.webp", now, index);
        let filepath = screenshots_dir.join(&filename);
        
        image.save_with_format(&filepath, image::ImageFormat::WebP)
            .map_err(|e| e.to_string())?;
            
        saved_paths.push(filepath.to_string_lossy().to_string());
    }
    
    let paths_str = saved_paths.join(",");

    // Get active window title and application name
    let (window_title, app_name) = get_current_active_window();

    println!(
        "[Tauri Rust] Screenshot captured! Monitors: {}, Paths: {}, Window: {} ({})",
        monitors.len(),
        paths_str,
        window_title,
        app_name
    );

    // Play native system shutter sound
    play_shutter_sound();

    // Emit event to frontend for visual notification/shutter sound
    let primary_path = saved_paths.first().cloned().unwrap_or_default();
    
    #[derive(serde::Serialize, Clone)]
    struct ScreenshotPayload {
        path: String,
        window_title: String,
        app_name: String,
    }
    
    let payload = ScreenshotPayload {
        path: primary_path,
        window_title: window_title.clone(),
        app_name: app_name.clone(),
    };

    let _ = app_handle.emit("screenshot-taken", payload);

    Ok(ScreenshotData {
        screenshot_path: paths_str,
        active_window_title: window_title,
        active_app_name: app_name,
    })
}

fn pause_countdown(app_handle: &tauri::AppHandle) {
    let review_state = app_handle.state::<PendingReviewState>();
    if let Some(handle) = review_state.countdown_abort_handle.lock().unwrap().take() {
        println!("[Tauri Rust] Pausing countdown task");
        handle.abort();
    }
    if let Some(win) = app_handle.get_webview_window("screenshot-widget") {
        let _ = win.emit("countdown-paused", ());
    }
}

fn resume_countdown(app_handle: &tauri::AppHandle) {
    let review_state = app_handle.state::<PendingReviewState>();
    
    // Check if we actually have pending review data
    let data_opt = review_state.data.lock().unwrap().clone();
    let id_clone = match data_opt {
        Some(data) => data.id,
        None => {
            println!("[Tauri Rust] resume_countdown called but no pending review data found");
            return;
        }
    };
    
    let remaining_on_resume = review_state.remaining_seconds.load(Ordering::SeqCst);
    println!("[Tauri Rust] Resuming screenshot countdown. Remaining seconds: {}", remaining_on_resume);
    
    // Abort any existing countdown task
    if let Some(handle) = review_state.countdown_abort_handle.lock().unwrap().take() {
        handle.abort();
    }
    
    let app_handle_clone = app_handle.clone();
    let id_clone_task = id_clone.clone();
    let countdown_task = tauri::async_runtime::spawn(async move {
        loop {
            let state = app_handle_clone.state::<PendingReviewState>();
            let remaining = state.remaining_seconds.load(Ordering::SeqCst);
            println!("[Tauri Rust] Countdown tick: remaining = {}", remaining);
            
            if let Some(win) = app_handle_clone.get_webview_window("screenshot-widget") {
                let _ = win.emit("countdown-tick", remaining);
            }
            
            if remaining <= 0 {
                println!("[Tauri Rust] Screenshot review timeout reached on resume. Auto-submitting block: {}", id_clone_task);
                if let Err(e) = do_submit_review(&app_handle_clone, id_clone_task.clone()) {
                    println!("[Tauri Rust] Auto-submit review failed: {}", e);
                }
                break;
            }
            
            state.remaining_seconds.store(remaining - 1, Ordering::SeqCst);
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        }
    });
    
    *review_state.countdown_abort_handle.lock().unwrap() = Some(countdown_task);
}

fn do_submit_review(app_handle: &tauri::AppHandle, id: String) -> Result<(), String> {
    let db_state = app_handle.state::<DbState>();
    let review_state = app_handle.state::<PendingReviewState>();
    
    let conn = Connection::open(&db_state.db_path).map_err(|e| e.to_string())?;
    conn.execute("UPDATE time_blocks SET review_pending = 0 WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    
    *review_state.data.lock().unwrap() = None;
    
    if let Some(win) = app_handle.get_webview_window("screenshot-widget") {
        let _ = win.hide();
    }
    
    if let Some(win) = app_handle.get_webview_window("screenshot-preview") {
        let _ = win.close();
    }
    Ok(())
}

fn trigger_screenshot_review(app_handle: &tauri::AppHandle, id: String, screenshot_path: String) {
    let review_state = app_handle.state::<PendingReviewState>();
    *review_state.data.lock().unwrap() = Some(PendingReviewData {
        id: id.clone(),
        screenshot_path,
    });
    
    // Reset countdown to 15 seconds
    review_state.remaining_seconds.store(15, Ordering::SeqCst);
    
    resume_countdown(app_handle);
    
    // Calculate logical screen coordinates for bottom right corner layout
    let mut x = 0.0;
    let mut y = 0.0;
    let mut scale_factor = 1.0;
    
    if let Ok(Some(monitor)) = app_handle.primary_monitor() {
        let size = monitor.size();
        scale_factor = monitor.scale_factor();
        let margin = 20.0 * scale_factor;
        let win_w = 280.0 * scale_factor;
        let win_h = 180.0 * scale_factor;
        
        x = (size.width as f64 - win_w - margin).max(0.0);
        y = (size.height as f64 - win_h - margin).max(0.0);
    }
    
    if let Some(win) = app_handle.get_webview_window("screenshot-widget") {
        let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x as i32, y as i32)));
        let _ = win.show();
        let _ = win.set_focus();
        let _ = win.emit("review-data-changed", ());
    } else {
        println!("[Tauri Rust] screenshot-widget window not found, building programmatically...");
        let logical_x = x / scale_factor;
        let logical_y = y / scale_factor;
        
        #[cfg(any(not(target_os = "macos"), feature = "macos-private-api"))]
        let widget_win = tauri::WebviewWindowBuilder::new(
            app_handle,
            "screenshot-widget",
            tauri::WebviewUrl::App("index.html".into())
        )
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .inner_size(280.0, 180.0)
        .position(logical_x, logical_y)
        .build();

        #[cfg(all(target_os = "macos", not(feature = "macos-private-api")))]
        let widget_win = tauri::WebviewWindowBuilder::new(
            app_handle,
            "screenshot-widget",
            tauri::WebviewUrl::App("index.html".into())
        )
        .decorations(false)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .inner_size(280.0, 180.0)
        .position(logical_x, logical_y)
        .build();
        
        match widget_win {
            Ok(win) => {
                let _ = win.show();
                let _ = win.set_focus();
                let _ = win.emit("review-data-changed", ());
            }
            Err(e) => {
                println!("[Tauri Rust] Failed to build screenshot-widget window programmatically: {:?}", e);
            }
        }
    }
}
#[tauri::command]
fn get_pending_review(
    state: tauri::State<'_, PendingReviewState>,
) -> Result<Option<PendingReviewData>, String> {
    Ok(state.data.lock().unwrap().clone())
}

#[tauri::command]
fn submit_review(
    id: String,
    app_handle: tauri::AppHandle,
    review_state: tauri::State<'_, PendingReviewState>,
) -> Result<(), String> {
    if let Some(handle) = review_state.countdown_abort_handle.lock().unwrap().take() {
        handle.abort();
    }
    do_submit_review(&app_handle, id)
}

#[tauri::command]
fn discard_review(
    id: String,
    app_handle: tauri::AppHandle,
    db_state: tauri::State<'_, DbState>,
    review_state: tauri::State<'_, PendingReviewState>,
) -> Result<(), String> {
    if let Some(handle) = review_state.countdown_abort_handle.lock().unwrap().take() {
        handle.abort();
    }
    
    let conn = Connection::open(&db_state.db_path).map_err(|e| e.to_string())?;
    let screenshot_path: Option<String> = conn.query_row(
        "SELECT screenshot_path FROM time_blocks WHERE id = ?1",
        params![id],
        |row| row.get(0)
    ).ok();
    
    conn.execute("DELETE FROM time_blocks WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    
    if let Some(path_list) = screenshot_path {
        if !path_list.trim().is_empty() {
            let paths: Vec<&str> = path_list.split(',').collect();
            for path in paths {
                let file_path = std::path::Path::new(path);
                if file_path.exists() {
                    let _ = std::fs::remove_file(file_path);
                }
            }
        }
    }
    
    *review_state.data.lock().unwrap() = None;
    
    if let Some(win) = app_handle.get_webview_window("screenshot-widget") {
        let _ = win.hide();
    }
    
    if let Some(win) = app_handle.get_webview_window("screenshot-preview") {
        let _ = win.close();
    }
    Ok(())
}

#[tauri::command]
fn open_screenshot_preview(
    screenshot_path: String,
    app_handle: tauri::AppHandle,
    review_state: tauri::State<'_, PendingReviewState>,
) -> Result<(), String> {
    *review_state.preview_path.lock().unwrap() = Some(screenshot_path);
    
    pause_countdown(&app_handle);
    
    if let Some(win) = app_handle.get_webview_window("screenshot-preview") {
        let _ = win.show();
        let _ = win.set_focus();
        let _ = win.emit("preview-path-changed", ());
    } else {
        let preview_win = tauri::WebviewWindowBuilder::new(
            &app_handle,
            "screenshot-preview",
            tauri::WebviewUrl::App("index.html".into())
        )
        .title("Preview Screenshot")
        .inner_size(800.0, 600.0)
        .decorations(true)
        .resizable(true)
        .build()
        .map_err(|e| e.to_string())?;
        
        let _ = preview_win.show();
    }
    Ok(())
}

#[tauri::command]
fn get_preview_path(
    review_state: tauri::State<'_, PendingReviewState>,
) -> Result<Option<String>, String> {
    Ok(review_state.preview_path.lock().unwrap().clone())
}

fn start_background_tick_loop(
    app_handle: tauri::AppHandle,
    project_id: String,
    issue_id: String,
    db_path: PathBuf,
) -> tokio::task::AbortHandle {
    let task = tokio::spawn(async move {
        // Every 2 minutes (120 seconds) for production tracking
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(120));
        // First tick resolves instantly, skip it
        interval.tick().await;

        loop {
            let timer_state = app_handle.state::<ActiveTimerState>();

            // Calculate random offset within the 2-minute block with a minimum delay of 15 seconds (e.g. 15 to 119 seconds)
            let min_delay = 15;
            let random_offset_secs = (min_delay + (chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0).abs() % (120 - min_delay))) as u64;
            
            // Spawn screenshot task
            let app_handle_clone = app_handle.clone();
            let current_screenshot_clone = std::sync::Arc::clone(&timer_state.current_screenshot);
            
            let shot_task = tokio::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_secs(random_offset_secs)).await;
                match capture_and_save_screenshot(&app_handle_clone) {
                    Ok(data) => {
                        *current_screenshot_clone.lock().unwrap() = Some(data);
                    }
                    Err(e) => {
                        println!("[Tauri Rust] Scheduled screenshot failed: {}", e);
                    }
                }
            });

            // Store screenshot abort handle
            *timer_state.screenshot_abort_handle.lock().unwrap() = Some(shot_task.abort_handle());

            interval.tick().await;
            
            // Abort the screenshot task if it's still running (e.g., if it was sleeping)
            if let Some(handle) = timer_state.screenshot_abort_handle.lock().unwrap().take() {
                handle.abort();
            }

            let now = chrono::Utc::now().timestamp();
            let block_start = {
                let mut curr = timer_state.current_block_start.lock().unwrap();
                let start = curr.unwrap_or(now - 120);
                *curr = Some(now);
                start
            };

            // Atomically swap event counters
            let k_count = KEYBOARD_COUNT.swap(0, Ordering::SeqCst);
            let m_count = MOUSE_COUNT.swap(0, Ordering::SeqCst);
            let activity = classify_activity(k_count, m_count);

            // Read the captured screenshot data (if any)
            let screenshot_data = timer_state.current_screenshot.lock().unwrap().take();
            let (s_path, s_title, s_app) = match screenshot_data {
                Some(ref data) => (Some(data.screenshot_path.as_str()), data.active_window_title.clone(), data.active_app_name.clone()),
                None => {
                    let (win_title, app_name) = get_current_active_window();
                    (None, win_title, app_name)
                }
            };

            let has_screenshot = s_path.is_some() && !s_path.unwrap().trim().is_empty();
            let review_pending = if has_screenshot { 1 } else { 0 };

            match commit_block_to_db(&db_path, &project_id, &issue_id, block_start, now, k_count, m_count, activity, s_path, Some(&s_title), Some(&s_app), review_pending) {
                Ok(inserted_id) => {
                    println!(
                        "[Tauri Rust] Committed 10m block: Proj={}, Issue={}, Start={}, End={}, Keys={}, Mouse={}, Activity={}, Screenshot={:?}",
                        project_id, issue_id, block_start, now, k_count, m_count, activity, s_path
                    );
                    if has_screenshot {
                        trigger_screenshot_review(&app_handle, inserted_id, s_path.unwrap().to_string());
                    }
                }
                Err(e) => {
                    println!("[Tauri Rust] Error committing time block: {}", e);
                }
            }
        }
    });

    task.abort_handle()
}

#[derive(serde::Serialize, Clone)]
struct TimerStateChangedPayload {
    status: String,
    start_time: Option<i64>,
    accumulated_seconds: u64,
}

pub struct TrayAssets {
    pub icon_idle: tauri::image::Image<'static>,
    pub icon_active: tauri::image::Image<'static>,
}

pub struct TrayMenuState {
    pub info_item: tauri::menu::MenuItem<tauri::Wry>,
    pub pause_resume_item: tauri::menu::MenuItem<tauri::Wry>,
}

fn emit_timer_state(app_handle: &tauri::AppHandle) {
    let timer_state = app_handle.state::<ActiveTimerState>();
    let status = timer_state.status.lock().unwrap().clone();
    let start_time = *timer_state.start_time.lock().unwrap();
    let accumulated_seconds = *timer_state.accumulated_seconds.lock().unwrap();
    let _ = app_handle.emit("timer-state-changed", TimerStateChangedPayload {
        status,
        start_time,
        accumulated_seconds,
    });
}

fn update_tray_state(app_handle: &tauri::AppHandle) {
    let timer_state = app_handle.state::<ActiveTimerState>();
    let tracking_state = app_handle.state::<ActiveTrackingState>();
    
    if let (Some(menu_state), Some(assets)) = (app_handle.try_state::<TrayMenuState>(), app_handle.try_state::<TrayAssets>()) {
        if let Some(tray) = app_handle.tray_by_id("main") {
            let status = timer_state.status.lock().unwrap().clone();
            let start_time = *timer_state.start_time.lock().unwrap();
            let accumulated_seconds = *timer_state.accumulated_seconds.lock().unwrap();
            let issue_title = tracking_state.issue_title.lock().unwrap().clone().unwrap_or_else(|| "Tidak Ada Task".to_string());

            let elapsed = if status == "Running" && start_time.is_some() {
                let now = chrono::Utc::now().timestamp();
                accumulated_seconds + (now - start_time.unwrap()) as u64
            } else {
                accumulated_seconds
            };

            let hours = elapsed / 3600;
            let minutes = (elapsed % 3600) / 60;
            let seconds = elapsed % 60;
            let time_str = format!("{:02}:{:02}:{:02}", hours, minutes, seconds);

            if status == "Running" {
                let _ = menu_state.info_item.set_text(format!("Sedang Melacak: {} — {}", issue_title, time_str));
                let _ = menu_state.pause_resume_item.set_text("⏸ Pause");
                let _ = menu_state.pause_resume_item.set_enabled(true);
                let _ = tray.set_icon(Some(assets.icon_active.clone()));
                #[cfg(target_os = "macos")]
                let _ = tray.set_icon_as_template(true);
            } else if status == "Paused" {
                let _ = menu_state.info_item.set_text(format!("Melacak Terjeda: {} — {}", issue_title, time_str));
                let _ = menu_state.pause_resume_item.set_text("▶ Resume");
                let _ = menu_state.pause_resume_item.set_enabled(true);
                let _ = tray.set_icon(Some(assets.icon_idle.clone()));
                #[cfg(target_os = "macos")]
                let _ = tray.set_icon_as_template(true);
            } else {
                let _ = menu_state.info_item.set_text("Tidak Melacak Task");
                let _ = menu_state.pause_resume_item.set_text("⏸ Pause / ▶ Resume");
                let _ = menu_state.pause_resume_item.set_enabled(false);
                let _ = tray.set_icon(Some(assets.icon_idle.clone()));
                #[cfg(target_os = "macos")]
                let _ = tray.set_icon_as_template(true);
            }
        }
    }
}

fn do_start_timer(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let tracking_state = app_handle.state::<ActiveTrackingState>();
    let timer_state = app_handle.state::<ActiveTimerState>();
    let db_state = app_handle.state::<DbState>();

    let mut status = timer_state.status.lock().unwrap();
    if *status == "Running" {
        return Err("Timer is already running".to_string());
    }

    let project_id = tracking_state.project_id.lock().unwrap().clone()
        .ok_or_else(|| "No project selected".to_string())?;
    let issue_id = tracking_state.issue_id.lock().unwrap().clone()
        .ok_or_else(|| "No task selected".to_string())?;

    let now = chrono::Utc::now().timestamp();

    // Reset counters on fresh start/resume
    KEYBOARD_COUNT.store(0, Ordering::SeqCst);
    MOUSE_COUNT.store(0, Ordering::SeqCst);

    // Clear any previous screenshots in state
    *timer_state.current_screenshot.lock().unwrap() = None;

    let mut start_time = timer_state.start_time.lock().unwrap();
    if start_time.is_none() {
        *start_time = Some(now);
    }

    let mut current_block_start = timer_state.current_block_start.lock().unwrap();
    *current_block_start = Some(now);

    *status = "Running".to_string();

    let handle = start_background_tick_loop(
        app_handle.clone(),
        project_id,
        issue_id,
        db_state.db_path.clone(),
    );

    *timer_state.abort_handle.lock().unwrap() = Some(handle);

    println!("[Tauri Rust] Timer started at Unix time {}", now);

    // Drop locks before emitting/updating to avoid deadlocks
    drop(status);
    drop(start_time);
    drop(current_block_start);

    emit_timer_state(app_handle);
    update_tray_state(app_handle);
    Ok(())
}

fn do_pause_timer(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let tracking_state = app_handle.state::<ActiveTrackingState>();
    let timer_state = app_handle.state::<ActiveTimerState>();
    let db_state = app_handle.state::<DbState>();

    let mut status = timer_state.status.lock().unwrap();
    if *status != "Running" {
        return Err("Timer is not running".to_string());
    }

    let now = chrono::Utc::now().timestamp();

    if let Some(handle) = timer_state.abort_handle.lock().unwrap().take() {
        handle.abort();
    }

    // Abort the scheduled screenshot task immediately
    if let Some(handle) = timer_state.screenshot_abort_handle.lock().unwrap().take() {
        handle.abort();
    }

    let project_id = tracking_state.project_id.lock().unwrap().clone()
        .ok_or_else(|| "No project selected".to_string())?;
    let issue_id = tracking_state.issue_id.lock().unwrap().clone()
        .ok_or_else(|| "No task selected".to_string())?;

    let k_count = KEYBOARD_COUNT.swap(0, Ordering::SeqCst);
    let m_count = MOUSE_COUNT.swap(0, Ordering::SeqCst);
    let activity = classify_activity(k_count, m_count);

    // Read screenshot data (if already taken)
    let screenshot_data = timer_state.current_screenshot.lock().unwrap().take();
    let (s_path, s_title, s_app) = match screenshot_data {
        Some(ref data) => (Some(data.screenshot_path.as_str()), data.active_window_title.clone(), data.active_app_name.clone()),
        None => {
            let (win_title, app_name) = get_current_active_window();
            (None, win_title, app_name)
        }
    };

    let mut current_block_start = timer_state.current_block_start.lock().unwrap();
    if let Some(start) = current_block_start.take() {
        if now > start {
            let has_screenshot = s_path.is_some() && !s_path.unwrap().trim().is_empty();
            let review_pending = if has_screenshot { 1 } else { 0 };

            match commit_block_to_db(&db_state.db_path, &project_id, &issue_id, start, now, k_count, m_count, activity, s_path, Some(&s_title), Some(&s_app), review_pending) {
                Ok(inserted_id) => {
                    println!(
                        "[Tauri Rust] Committed partial block on pause ({}s). Keys={}, Mouse={}, Activity={}",
                        now - start, k_count, m_count, activity
                    );
                    if has_screenshot {
                        trigger_screenshot_review(app_handle, inserted_id, s_path.unwrap().to_string());
                    }
                }
                Err(e) => {
                    println!("[Tauri Rust] Error committing partial block on pause: {}", e);
                }
            }

            let mut accumulated = timer_state.accumulated_seconds.lock().unwrap();
            *accumulated += (now - start) as u64;
        }
    }

    *status = "Paused".to_string();
    println!("[Tauri Rust] Timer paused");

    // Drop locks before emitting/updating to avoid deadlocks
    drop(status);
    drop(current_block_start);

    emit_timer_state(app_handle);
    update_tray_state(app_handle);
    Ok(())
}

fn do_stop_timer(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let tracking_state = app_handle.state::<ActiveTrackingState>();
    let timer_state = app_handle.state::<ActiveTimerState>();
    let db_state = app_handle.state::<DbState>();

    let mut status = timer_state.status.lock().unwrap();
    if *status == "Idle" {
        return Ok(());
    }

    let now = chrono::Utc::now().timestamp();

    if let Some(handle) = timer_state.abort_handle.lock().unwrap().take() {
        handle.abort();
    }

    // Abort the scheduled screenshot task immediately
    if let Some(handle) = timer_state.screenshot_abort_handle.lock().unwrap().take() {
        handle.abort();
    }

    if *status == "Running" {
        let project_id = tracking_state.project_id.lock().unwrap().clone()
            .ok_or_else(|| "No project selected".to_string())?;
        let issue_id = tracking_state.issue_id.lock().unwrap().clone()
            .ok_or_else(|| "No task selected".to_string())?;

        let k_count = KEYBOARD_COUNT.swap(0, Ordering::SeqCst);
        let m_count = MOUSE_COUNT.swap(0, Ordering::SeqCst);
        let activity = classify_activity(k_count, m_count);

        let screenshot_data = timer_state.current_screenshot.lock().unwrap().take();
        let (s_path, s_title, s_app) = match screenshot_data {
            Some(ref data) => (Some(data.screenshot_path.as_str()), data.active_window_title.clone(), data.active_app_name.clone()),
            None => {
                let (win_title, app_name) = get_current_active_window();
                (None, win_title, app_name)
            }
        };

        let mut current_block_start = timer_state.current_block_start.lock().unwrap();
        if let Some(start) = current_block_start.take() {
            if now > start {
                let has_screenshot = s_path.is_some() && !s_path.unwrap().trim().is_empty();
                let review_pending = if has_screenshot { 1 } else { 0 };

                match commit_block_to_db(&db_state.db_path, &project_id, &issue_id, start, now, k_count, m_count, activity, s_path, Some(&s_title), Some(&s_app), review_pending) {
                    Ok(inserted_id) => {
                        println!(
                            "[Tauri Rust] Committed final partial block on stop ({}s). Keys={}, Mouse={}, Activity={}",
                            now - start, k_count, m_count, activity
                        );
                        if has_screenshot {
                            trigger_screenshot_review(app_handle, inserted_id, s_path.unwrap().to_string());
                        }
                    }
                    Err(e) => {
                        println!("[Tauri Rust] Error committing final partial block on stop: {}", e);
                    }
                }
            }
        }
    } else {
        KEYBOARD_COUNT.store(0, Ordering::SeqCst);
        MOUSE_COUNT.store(0, Ordering::SeqCst);
        *timer_state.current_screenshot.lock().unwrap() = None;
        let mut current_block_start = timer_state.current_block_start.lock().unwrap();
        *current_block_start = None;
    }

    *timer_state.start_time.lock().unwrap() = None;
    *timer_state.accumulated_seconds.lock().unwrap() = 0;
    *status = "Idle".to_string();

    println!("[Tauri Rust] Timer stopped and reset");

    // Drop locks before emitting/updating to avoid deadlocks
    drop(status);

    emit_timer_state(app_handle);
    update_tray_state(app_handle);
    Ok(())
}

#[tauri::command]
async fn start_timer(app_handle: tauri::AppHandle) -> Result<(), String> {
    do_start_timer(&app_handle)
}

#[tauri::command]
async fn pause_timer(app_handle: tauri::AppHandle) -> Result<(), String> {
    do_pause_timer(&app_handle)
}

#[tauri::command]
async fn stop_timer(app_handle: tauri::AppHandle) -> Result<(), String> {
    do_stop_timer(&app_handle)
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

// DTO Serialization Structs for Sync Service Backend
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ActivityDto {
    keyboard_count: u32,
    mouse_count: u32,
    active_app_name: String,
    active_window_title: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncTimeBlockDto {
    project_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    issue_id: Option<String>,
    block_start: String,
    block_end: String,
    activity: ActivityDto,
}

#[derive(Debug)]
enum SyncError {
    Unauthorized,
    Network(String),
    Other(String),
}

impl std::fmt::Display for SyncError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SyncError::Unauthorized => write!(f, "Unauthorized (401)"),
            SyncError::Network(s) => write!(f, "Network connection error: {}", s),
            SyncError::Other(s) => write!(f, "Sync failure: {}", s),
        }
    }
}

#[derive(serde::Deserialize)]
struct TimeBlockResponse {
    id: String,
}

#[derive(serde::Deserialize)]
struct SyncResponse {
    #[serde(rename = "timeBlock")]
    time_block: TimeBlockResponse,
}

#[derive(serde::Deserialize)]
struct ScreenshotUrlResponse {
    #[serde(rename = "uploadUrl")]
    upload_url: String,
}

async fn upload_screenshot_file(
    path: &str,
    time_block_id: &str,
    token: &str,
    client: &reqwest::Client,
) -> Result<(), SyncError> {
    let url_endpoint = format!("http://localhost:3000/time-blocks/{}/screenshot", time_block_id);
    let response = client.post(&url_endpoint)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| SyncError::Network(e.to_string()))?;

    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err(SyncError::Unauthorized);
    }
    if !response.status().is_success() {
        return Err(SyncError::Other(format!("Screenshot URL endpoint returned status: {}", response.status())));
    }

    let url_res: ScreenshotUrlResponse = response.json().await
        .map_err(|e| SyncError::Other(format!("Failed to parse screenshot URL response: {}", e)))?;

    let file_path = std::path::Path::new(path);
    if !file_path.exists() {
        println!("[Tauri Rust] Screenshot file not found: {}, skipping upload", path);
        return Ok(());
    }

    let image_bytes = std::fs::read(file_path)
        .map_err(|e| SyncError::Other(format!("Failed to read local screenshot file: {}", e)))?;

    let put_response = client.put(&url_res.upload_url)
        .header("Content-Type", "image/webp")
        .body(image_bytes)
        .send()
        .await
        .map_err(|e| SyncError::Network(e.to_string()))?;

    if !put_response.status().is_success() {
        return Err(SyncError::Other(format!("R2 upload returned status: {}", put_response.status())));
    }

    let _ = std::fs::remove_file(file_path);
    println!("[Tauri Rust] Successfully uploaded screenshot to R2 and deleted local file: {}", path);

    Ok(())
}

struct LocalTimeBlock {
    id: String,
    project_id: String,
    issue_id: Option<String>,
    block_start: String,
    block_end: String,
    keyboard_count: u32,
    mouse_count: u32,
    screenshot_path: Option<String>,
    active_window_title: Option<String>,
    active_app_name: Option<String>,
    _retry_count: u32,
}

async fn sync_pending_blocks(
    db_path: &std::path::Path,
    token: &str,
    client: &reqwest::Client,
    _app_handle: &tauri::AppHandle,
) -> Result<bool, SyncError> {
    let pending = {
        let conn = Connection::open(db_path)
            .map_err(|e| SyncError::Other(format!("Failed to open DB for sync: {}", e)))?;

        // Query all unsynced blocks that have failed less than 5 times and are not pending review
        let mut stmt = conn
            .prepare(
                "SELECT id, project_id, issue_id, block_start, block_end, keyboard_count, mouse_count, activity_level, screenshot_path, active_window_title, active_app_name, retry_count 
                 FROM time_blocks WHERE synced = 0 AND review_pending = 0 AND retry_count < 5 ORDER BY block_start ASC",
            )
            .map_err(|e| SyncError::Other(format!("Failed to prepare select statement: {}", e)))?;

        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, u32>(5)?,
                    row.get::<_, u32>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, Option<String>>(8)?,
                    row.get::<_, Option<String>>(9)?,
                    row.get::<_, Option<String>>(10)?,
                    row.get::<_, u32>(11)?,
                ))
            })
            .map_err(|e| SyncError::Other(format!("Failed to query time blocks: {}", e)))?;

        let mut pending = Vec::new();
        for row_res in rows {
            let (
                local_id,
                project_id,
                issue_id,
                block_start_str,
                block_end_str,
                k_count,
                m_count,
                _activity_level,
                screenshot_path,
                active_window_title,
                active_app_name,
                retry_count,
            ) = row_res.map_err(|e| SyncError::Other(format!("Row error: {}", e)))?;

            pending.push(LocalTimeBlock {
                id: local_id,
                project_id,
                issue_id,
                block_start: block_start_str,
                block_end: block_end_str,
                keyboard_count: k_count,
                mouse_count: m_count,
                screenshot_path,
                active_window_title,
                active_app_name,
                _retry_count: retry_count,
            });
        }
        pending
    };

    let mut synced_any = false;

    for block in pending {
        // Parse UNIX timestamps
        let start_ts: i64 = block.block_start.parse().unwrap_or(0);
        let end_ts: i64 = block.block_end.parse().unwrap_or(0);

        // Format to ISO 8601
        let start_iso = chrono::DateTime::from_timestamp(start_ts, 0)
            .map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
            .unwrap_or_default();
        let end_iso = chrono::DateTime::from_timestamp(end_ts, 0)
            .map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
            .unwrap_or_default();

        let sync_dto = SyncTimeBlockDto {
            project_id: block.project_id.clone(),
            issue_id: block.issue_id.clone(),
            block_start: start_iso,
            block_end: end_iso,
            activity: ActivityDto {
                keyboard_count: block.keyboard_count,
                mouse_count: block.mouse_count,
                active_app_name: {
                    let app = block.active_app_name.clone().unwrap_or_default();
                    if app.trim().is_empty() { "Unknown".to_string() } else { app }
                },
                active_window_title: {
                    let title = block.active_window_title.clone().unwrap_or_default();
                    if title.trim().is_empty() { "Unknown".to_string() } else { title }
                },
            },
        };

        println!("[Tauri Rust] Syncing block {} (Proj={}) to backend...", block.id, block.project_id);

        let sync_result = async {
            let response = client.post("http://localhost:3000/time-blocks/sync")
                .header("Authorization", format!("Bearer {}", token))
                .json(&sync_dto)
                .send()
                .await
                .map_err(|e| SyncError::Network(e.to_string()))?;

            if response.status() == reqwest::StatusCode::UNAUTHORIZED {
                return Err(SyncError::Unauthorized);
            }
            if !response.status().is_success() {
                let status = response.status();
                let error_text = response.text().await.unwrap_or_default();
                return Err(SyncError::Other(format!("Backend returned status: {}, body: {}", status, error_text)));
            }

            let sync_res: SyncResponse = response.json().await
                .map_err(|e| SyncError::Other(format!("Failed to parse sync response: {}", e)))?;
            let time_block_id = sync_res.time_block.id;

            // If there's a screenshot, upload it
            if let Some(ref path_list) = block.screenshot_path {
                if !path_list.trim().is_empty() {
                    let paths: Vec<&str> = path_list.split(',').collect();
                    for path in paths {
                        upload_screenshot_file(path, &time_block_id, token, client).await?;
                    }
                }
            }
            Ok(())
        }.await;

        match sync_result {
            Ok(_) => {
                // Mark local SQLite row as synced = 1
                let update_conn = Connection::open(db_path)
                    .map_err(|e| SyncError::Other(format!("Failed to open DB to mark synced: {}", e)))?;
                update_conn.execute("UPDATE time_blocks SET synced = 1 WHERE id = ?1", params![block.id])
                    .map_err(|e| SyncError::Other(format!("Failed to update local DB status: {}", e)))?;
                synced_any = true;
            }
            Err(SyncError::Unauthorized) => {
                return Err(SyncError::Unauthorized);
            }
            Err(SyncError::Network(e)) => {
                // Abort sync loop since connection/server is offline
                return Err(SyncError::Network(e));
            }
            Err(SyncError::Other(e)) => {
                // For validation or server errors, increment retry_count to avoid blocking subsequent blocks
                println!("[Tauri Rust] Validation/Server error syncing block {}: {}. Incrementing retry count.", block.id, e);
                let update_conn = Connection::open(db_path)
                    .map_err(|e| SyncError::Other(format!("Failed to open DB to increment retry: {}", e)))?;
                let _ = update_conn.execute("UPDATE time_blocks SET retry_count = retry_count + 1 WHERE id = ?1", params![block.id]);
            }
        }
    }

    Ok(synced_any)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(ActiveTrackingState::default())
        .manage(ActiveTimerState::default())
        .manage(AppState::default())
        .manage(PendingReviewState::default())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                println!("[Tauri Rust] CloseRequested event for window: {}", window.label());
                if window.label() == "screenshot-preview" {
                    resume_countdown(window.app_handle());
                } else if window.label() == "screenshot-widget" {
                    api.prevent_close();
                    let _ = window.hide();
                } else if !ALLOW_REAL_EXIT.load(Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().unwrap();
            std::fs::create_dir_all(&app_data_dir).unwrap();
            let db_path = app_data_dir.join("trackflow_local.db");
            
            // Initialize database schema
            let conn = rusqlite::Connection::open(&db_path).unwrap();
            conn.execute(
                "CREATE TABLE IF NOT EXISTS time_blocks (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    issue_id TEXT NOT NULL,
                    block_start TEXT NOT NULL,
                    block_end TEXT NOT NULL,
                    keyboard_count INTEGER NOT NULL DEFAULT 0,
                    mouse_count INTEGER NOT NULL DEFAULT 0,
                    activity_level TEXT NOT NULL DEFAULT 'none',
                    screenshot_path TEXT,
                    active_window_title TEXT,
                    active_app_name TEXT,
                    retry_count INTEGER NOT NULL DEFAULT 0,
                    synced INTEGER NOT NULL DEFAULT 0,
                    review_pending INTEGER NOT NULL DEFAULT 0
                )",
                [],
            ).unwrap();
            
            // Alter columns for migrations (development safe)
            let _ = conn.execute("ALTER TABLE time_blocks ADD COLUMN keyboard_count INTEGER NOT NULL DEFAULT 0", []);
            let _ = conn.execute("ALTER TABLE time_blocks ADD COLUMN mouse_count INTEGER NOT NULL DEFAULT 0", []);
            let _ = conn.execute("ALTER TABLE time_blocks ADD COLUMN activity_level TEXT NOT NULL DEFAULT 'none'", []);
            let _ = conn.execute("ALTER TABLE time_blocks ADD COLUMN screenshot_path TEXT", []);
            let _ = conn.execute("ALTER TABLE time_blocks ADD COLUMN active_window_title TEXT", []);
            let _ = conn.execute("ALTER TABLE time_blocks ADD COLUMN active_app_name TEXT", []);
            let _ = conn.execute("ALTER TABLE time_blocks ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0", []);
            let _ = conn.execute("ALTER TABLE time_blocks ADD COLUMN review_pending INTEGER NOT NULL DEFAULT 0", []);
            
            let db_path_sync = db_path.clone();
            app.manage(DbState { db_path });

            // macOS dock icon setup (Accessory mode) and custom menu (excl. Quit to disable Cmd+Q)
            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);

                use tauri::menu::{MenuBuilder, SubmenuBuilder};
                let app_menu = SubmenuBuilder::new(app, "TrackFlow")
                    .about(None)
                    .separator()
                    .hide()
                    .build()?;

                let edit_menu = SubmenuBuilder::new(app, "Edit")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .select_all()
                    .build()?;

                let menu = MenuBuilder::new(app)
                    .item(&app_menu)
                    .item(&edit_menu)
                    .build()?;

                app.set_menu(menu)?;
            }

            // Load tray assets
            let icon_idle = tauri::image::Image::from_bytes(include_bytes!("../icons/tray-idle.png")).unwrap();
            let icon_active = tauri::image::Image::from_bytes(include_bytes!("../icons/tray-active.png")).unwrap();

            app.manage(TrayAssets {
                icon_idle: icon_idle.clone(),
                icon_active: icon_active.clone(),
            });

            // Create tray menu
            let info_item = tauri::menu::MenuItem::with_id(app, "tray_info", "Tidak Melacak Task", false, None::<&str>)?;
            let pause_resume_item = tauri::menu::MenuItem::with_id(app, "tray_pause_resume", "⏸ Pause / ▶ Resume", true, None::<&str>)?;
            let open_item = tauri::menu::MenuItem::with_id(app, "tray_open", "↗ Buka TrackFlow", true, None::<&str>)?;
            let quit_item = tauri::menu::MenuItem::with_id(app, "tray_quit", "⏻ Keluar", true, None::<&str>)?;

            let tray_menu = tauri::menu::Menu::with_items(app, &[
                &info_item,
                &tauri::menu::PredefinedMenuItem::separator(app)?,
                &pause_resume_item,
                &open_item,
                &tauri::menu::PredefinedMenuItem::separator(app)?,
                &quit_item,
            ])?;

            app.manage(TrayMenuState {
                info_item: info_item.clone(),
                pause_resume_item: pause_resume_item.clone(),
            });

            let _tray = tauri::tray::TrayIconBuilder::with_id("main")
                .icon(icon_idle.clone())
                .icon_as_template(true)
                .menu(&tray_menu)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "tray_quit" => {
                            ALLOW_REAL_EXIT.store(true, Ordering::SeqCst);
                            *app.state::<AppState>().is_quitting.lock().unwrap() = true;
                            let _ = do_stop_timer(app);
                            app.exit(0);
                        }
                        "tray_open" => {
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                        "tray_pause_resume" => {
                            let timer_state = app.state::<ActiveTimerState>();
                            let status = timer_state.status.lock().unwrap().clone();
                            if status == "Running" {
                                if let Err(e) = do_pause_timer(app) {
                                    println!("[Tauri Rust] Tray pause error: {}", e);
                                }
                            } else if status == "Paused" {
                                if let Err(e) = do_start_timer(app) {
                                    println!("[Tauri Rust] Tray resume error: {}", e);
                                }
                            }
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // Spawn resilient global input hook listener in OS thread
            std::thread::spawn(move || {
                loop {
                    println!("[Tauri Rust] Starting global rdev listener...");
                    if let Err(e) = rdev::listen(input_callback) {
                        println!("[Tauri Rust] rdev listener failed: {:?}. Retrying in 5 seconds...", e);
                    }
                    std::thread::sleep(std::time::Duration::from_secs(5));
                }
            });

            // Spawn background synchronization routine
            let app_handle_sync = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let client = reqwest::Client::new();
                let mut sync_interval_secs = 15;
                
                loop {
                    tokio::time::sleep(tokio::time::Duration::from_secs(sync_interval_secs)).await;
                    
                    let token = match get_token() {
                        Ok(t) if !t.trim().is_empty() => t,
                        _ => {
                            sync_interval_secs = 15;
                            continue;
                        }
                    };

                    match sync_pending_blocks(&db_path_sync, &token, &client, &app_handle_sync).await {
                        Ok(synced_any) => {
                            if synced_any {
                                println!("[Tauri Rust] Sync completed successfully.");
                            }
                            sync_interval_secs = 15; // Reset interval to default
                        }
                        Err(SyncError::Unauthorized) => {
                            println!("[Tauri Rust] Sync unauthorized (401). Pausing sync and notifying frontend...");
                            let _ = app_handle_sync.emit("sync-unauthorized", ());
                            sync_interval_secs = 30; // Sleep a bit before checking token again
                        }
                        Err(SyncError::Network(e)) => {
                            println!("[Tauri Rust] Sync network error: {}. Backing off...", e);
                            sync_interval_secs = std::cmp::min(sync_interval_secs * 2, 120); // Exponential backoff up to 2m
                        }
                        Err(SyncError::Other(e)) => {
                            println!("[Tauri Rust] Sync other error: {}. Backing off...", e);
                            sync_interval_secs = std::cmp::min(sync_interval_secs * 2, 60); // Backoff up to 1m
                        }
                    }
                }
            });

            // Spawn background application updater routine
            let app_handle_updater = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Sleep 3 seconds after startup to let app initialize
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                println!("[Tauri Rust] Checking for application updates...");
                use tauri_plugin_updater::UpdaterExt;
                match app_handle_updater.updater() {
                    Ok(updater) => {
                        match updater.check().await {
                            Ok(Some(update)) => {
                                println!("[Tauri Rust] Found update: version={}, body={:?}", update.version, update.body);
                                println!("[Tauri Rust] Automatically downloading and installing update...");
                                match update.download_and_install(|chunk_length, content_length| {
                                    println!("[Tauri Rust] Update download progress: chunk={}, total={:?}", chunk_length, content_length);
                                }, || {
                                    println!("[Tauri Rust] Update installed successfully! Relaunching...");
                                }).await {
                                    Ok(_) => {
                                        app_handle_updater.restart();
                                    }
                                    Err(e) => {
                                        println!("[Tauri Rust] Failed to install update: {}", e);
                                    }
                                }
                            }
                            Ok(None) => {
                                println!("[Tauri Rust] Application is up-to-date (no updates found).");
                            }
                            Err(e) => {
                                println!("[Tauri Rust] Failed to check for updates: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        println!("[Tauri Rust] Failed to get updater instance: {}", e);
                    }
                }
            });

            // Spawn background tray update routine (1 second interval)
            let app_handle_tray = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                    update_tray_state(&app_handle_tray);
                }
            });

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
            get_timer_state,
            check_input_permission,
            get_pending_review,
            submit_review,
            discard_review,
            open_screenshot_preview,
            get_preview_path
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            tauri::RunEvent::ExitRequested { api, .. } => {
                if !ALLOW_REAL_EXIT.load(Ordering::SeqCst) {
                    api.prevent_exit();
                    if let Some(win) = app_handle.get_webview_window("main") {
                        let _ = win.hide();
                    }
                }
            }
            _ => {}
        });
}
