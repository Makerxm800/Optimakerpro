use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

#[derive(Serialize)]
pub struct UpdateInfo {
    pub current_version: String,
    pub available: bool,
    pub version: Option<String>,
    pub notes: Option<String>,
    pub download_size: u64,
    pub message: Option<String>,
}

fn up_to_date(app: &AppHandle, message: &str) -> UpdateInfo {
    UpdateInfo {
        current_version: app.package_info().version.to_string(),
        available: false,
        version: None,
        notes: None,
        download_size: 0,
        message: Some(message.to_string()),
    }
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateInfo, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await {
        Ok(Some(update)) => Ok(UpdateInfo {
            current_version: app.package_info().version.to_string(),
            available: true,
            version: Some(update.version.clone()),
            notes: update.body.clone(),
            // The plugin exposes no total up front; the real total arrives with
            // the first update-progress event (content_length in the callback).
            download_size: 0,
            message: None,
        }),
        Ok(None) => Ok(up_to_date(&app, "You're on the latest version.")),
        Err(e) => {
            let text = e.to_string().to_lowercase();
            if text.contains("404")
                || text.contains("not found")
                || text.contains("no release")
                || text.contains("release not")
            {
                Ok(up_to_date(
                    &app,
                    "No update feed published yet — you're on the latest build.",
                ))
            } else {
                Err(e.to_string())
            }
        }
    }
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or("No update available")?;

    tauri::async_runtime::spawn(async move {
        let mut downloaded: u64 = 0;
        let progress_app = app.clone();
        let result = update
            .download_and_install(
                |chunk, content_length| {
                    downloaded += chunk as u64;
                    let total = content_length.unwrap_or(0);
                    let _ = progress_app.emit(
                        "update-progress",
                        serde_json::json!({ "downloaded": downloaded, "total": total }),
                    );
                },
                || {},
            )
            .await;
        match result {
            Ok(()) => {
                let _ = app.emit("update-installed", serde_json::json!({}));
            }
            Err(e) => {
                let _ = app.emit(
                    "update-failed",
                    serde_json::json!({ "message": e.to_string() }),
                );
            }
        }
    });

    Ok(())
}
