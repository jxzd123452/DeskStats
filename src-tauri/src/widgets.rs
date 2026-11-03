use std::collections::{BTreeMap, HashSet};
use std::sync::{Arc, Mutex, MutexGuard};

use tauri::webview::WebviewWindowBuilder;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindow, WindowEvent};

use crate::model::WidgetSpec;

pub struct WidgetHost {
    pub suppressing_close: Mutex<HashSet<String>>,
    pub gate: Mutex<()>,
}

impl Default for WidgetHost {
    fn default() -> Self {
        Self {
            suppressing_close: Mutex::new(HashSet::new()),
            gate: Mutex::new(()),
        }
    }
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|err| err.into_inner())
}

pub fn widget_label(kind: &str) -> Option<String> {
    if kind_ok(kind) {
        Some(format!("widget-{kind}"))
    } else {
        None
    }
}

fn kind_ok(kind: &str) -> bool {
    matches!(
        kind,
        "cpu" | "memory" | "gpu" | "network" | "disks" | "sensors"
    )
}

fn defaults(kind: &str) -> (f64, f64, f64, f64) {
    match kind {
        "cpu" => (250.0, 168.0, 48.0, 64.0),
        "memory" => (230.0, 156.0, 320.0, 64.0),
        "gpu" => (240.0, 168.0, 572.0, 64.0),
        "network" => (280.0, 160.0, 48.0, 260.0),
        "disks" => (250.0, 176.0, 348.0, 260.0),
        _ => (240.0, 168.0, 620.0, 260.0),
    }
}

fn clamp_dim(value: f64, min: f64, max: f64, fallback: f64) -> f64 {
    if !value.is_finite() || value <= 0.0 {
        return fallback;
    }
    value.clamp(min, max)
}

fn clamp_pos(value: f64, fallback: f64) -> f64 {
    if !value.is_finite() {
        return fallback;
    }
    value.clamp(-500.0, 12_000.0)
}

pub fn normalize_specs(specs: Vec<WidgetSpec>) -> Vec<WidgetSpec> {
    let mut map = BTreeMap::new();
    for spec in specs {
        if !kind_ok(&spec.kind) {
            continue;
        }
        let (width, height, x, y) = defaults(&spec.kind);
        let mode = if spec.mode == "desktop" {
            "desktop"
        } else {
            "top"
        };
        map.insert(
            spec.kind.clone(),
            WidgetSpec {
                kind: spec.kind,
                open: spec.open,
                x: clamp_pos(spec.x, x),
                y: clamp_pos(spec.y, y),
                width: clamp_dim(spec.width, 180.0, 720.0, width),
                height: clamp_dim(spec.height, 120.0, 520.0, height),
                mode: mode.to_string(),
                click_through: spec.click_through,
            },
        );
    }
    map.into_values().collect()
}

fn widget_script(kind: &str) -> String {
    format!(
        r#"(function(){{var k={kind:?};window.__DESKSTATS_WIDGET__=k;var apply=function(){{var root=document.documentElement;if(!root)return;root.dataset.widget=k;root.style.background="transparent";if(document.body)document.body.style.background="transparent";}};apply();document.addEventListener("DOMContentLoaded",apply);}})();"#
    )
}

fn apply_chrome(window: &WebviewWindow, spec: &WidgetSpec) {
    let desktop = spec.mode == "desktop";
    if desktop {
        let _ = window.set_always_on_top(false);
        let _ = window.set_always_on_bottom(true);
    } else {
        let _ = window.set_always_on_bottom(false);
        let _ = window.set_always_on_top(true);
    }
    let _ = window.set_ignore_cursor_events(spec.click_through);
    let _ = window.set_visible_on_all_workspaces(true);
}

fn emit_geometry(app: &AppHandle, window: &WebviewWindow, kind: &str) {
    let scale = window.scale_factor().unwrap_or(1.0).max(0.01);
    let Ok(pos) = window.outer_position() else {
        return;
    };
    let Ok(size) = window.inner_size() else {
        return;
    };
    let _ = app.emit_to(
        "main",
        "widget-geometry",
        serde_json::json!({
            "kind": kind,
            "x": pos.x as f64 / scale,
            "y": pos.y as f64 / scale,
            "width": size.width as f64 / scale,
            "height": size.height as f64 / scale,
        }),
    );
}

fn attach(app: AppHandle, window: WebviewWindow, kind: String, host: Arc<WidgetHost>) {
    let app_events = app.clone();
    let kind_events = kind.clone();
    window.on_window_event(move |event| match event {
        WindowEvent::CloseRequested { .. } => {
            let suppressed = lock(&host.suppressing_close).remove(&kind_events);
            if suppressed {
                return;
            }
            let _ = app_events.emit_to("main", "widget-closed", kind_events.clone());
        }
        WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
            let label = format!("widget-{kind_events}");
            if let Some(win) = app_events.get_webview_window(&label) {
                emit_geometry(&app_events, &win, &kind_events);
            }
        }
        _ => {}
    });
}

fn open_widget(app: &AppHandle, host: &Arc<WidgetHost>, spec: &WidgetSpec) -> tauri::Result<()> {
    let Some(label) = widget_label(&spec.kind) else {
        return Ok(());
    };
    if let Some(window) = app.get_webview_window(&label) {
        apply_chrome(&window, spec);
        return Ok(());
    }
    let builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("index.html".into()))
        .title(format!("DeskStats · {}", spec.kind))
        .inner_size(spec.width, spec.height)
        .min_inner_size(180.0, 120.0)
        .position(spec.x, spec.y)
        .decorations(false)
        .transparent(true)
        .resizable(true)
        .skip_taskbar(true)
        .always_on_top(spec.mode != "desktop")
        .initialization_script(widget_script(&spec.kind))
        .shadow(cfg!(not(target_os = "linux")));
    #[cfg(not(target_os = "linux"))]
    let builder = builder.background_color(tauri::window::Color(0, 0, 0, 0));
    let window = builder.build()?;
    apply_chrome(&window, spec);
    attach(app.clone(), window, spec.kind.clone(), Arc::clone(host));
    Ok(())
}

fn close_widget(app: &AppHandle, host: &WidgetHost, label: &str) {
    let Some(window) = app.get_webview_window(label) else {
        return;
    };
    lock(&host.suppressing_close).insert(label.to_string());
    let _ = window.close();
}

pub fn apply_widgets(
    app: &AppHandle,
    host: &Arc<WidgetHost>,
    specs: Vec<WidgetSpec>,
) -> tauri::Result<()> {
    let specs = normalize_specs(specs);
    let desired: HashSet<String> = specs
        .iter()
        .filter(|spec| spec.open)
        .filter_map(|spec| widget_label(&spec.kind))
        .collect();
    let existing: Vec<String> = app
        .webview_windows()
        .keys()
        .filter(|label| label.starts_with("widget-"))
        .cloned()
        .collect();
    for label in existing {
        if !desired.contains(&label) {
            close_widget(app, host, &label);
        }
    }
    for spec in specs.iter().filter(|spec| spec.open) {
        open_widget(app, host, spec)?;
    }
    Ok(())
}

#[tauri::command]
pub fn sync_widgets(
    app: AppHandle,
    host: State<'_, Arc<WidgetHost>>,
    widgets: Vec<WidgetSpec>,
) -> Result<(), String> {
    let host = Arc::clone(&host);
    let _gate = lock(&host.gate);
    apply_widgets(&app, &host, widgets).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn begin_widget_resize(window: tauri::Window) {
    if !window.label().starts_with("widget-") {
        return;
    }
    let _ = window.start_resize_dragging(tauri_runtime::ResizeDirection::SouthEast);
}

pub fn any_widget_open(app: &AppHandle) -> bool {
    app.webview_windows()
        .keys()
        .any(|label| label.starts_with("widget-"))
}

/// True when the main window and every widget are hidden or minimized.
/// Sampling slows down only in that case — open widgets keep the live rate.
pub fn foreground_hidden(app: &AppHandle) -> bool {
    for (label, window) in app.webview_windows() {
        if label != "main" && !label.starts_with("widget-") {
            continue;
        }
        let visible = window.is_visible().unwrap_or(false);
        let minimized = window.is_minimized().unwrap_or(false);
        if visible && !minimized {
            return false;
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spec(kind: &str, width: f64, height: f64, mode: &str) -> WidgetSpec {
        WidgetSpec {
            kind: kind.into(),
            open: true,
            x: 12.0,
            y: -9_999.0,
            width,
            height,
            mode: mode.into(),
            click_through: true,
        }
    }

    #[test]
    fn drops_unknown_kinds_and_clamps_geometry() {
        let out = normalize_specs(vec![
            spec("cpu", 10.0, 9_999.0, "desktop"),
            spec("nope", 200.0, 200.0, "top"),
        ]);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].kind, "cpu");
        assert!(out[0].width >= 180.0);
        assert!(out[0].height <= 520.0);
        assert_eq!(out[0].mode, "desktop");
        assert!(out[0].click_through);
        assert!(out[0].y >= -500.0);
    }

    #[test]
    fn repairs_invalid_numbers() {
        let mut broken = spec("memory", 0.0, 0.0, "sideways");
        broken.x = f64::NAN;
        broken.open = false;
        broken.click_through = false;
        let out = normalize_specs(vec![broken]);
        assert_eq!(out[0].mode, "top");
        assert!(out[0].x.is_finite());
        assert!(out[0].width >= 180.0);
        assert!(!out[0].open);
    }
}
