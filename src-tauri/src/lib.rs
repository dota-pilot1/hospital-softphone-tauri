#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Hospital Softphone!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // NOTE: 자동 업데이터는 서명 키/릴리스 설정 후 복구 예정.
    // tauri.conf.json 의 plugins.updater 설정 없이 플러그인을 등록하면 실행 시 패닉하므로 지금은 미등록.
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
