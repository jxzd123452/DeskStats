mod collect;
mod demo;
mod gpu_nvml;
mod metrics;
mod model;

use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

use tauri::menu::{CheckMenuItem, Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
#[cfg(target_os = "macos")]
use tauri::window::{Effect, EffectState, EffectsBuilder};
#[cfg(target_os = "windows")]
use tauri::window::{Effect, EffectsBuilder};
use tauri::{AppHandle, Emitter, Manager, State, Theme, WebviewWindow, WindowEvent};

use collect::Collector;
use demo::DemoEngine;
use metrics::{
    effective_interval_ms, format_bytes, format_rate, format_uptime, percent_of, sanitize_interval,
};
use model::{empty_snapshot, HostMeta, SamplerSettings, Snapshot, TrayLabels};

struct AppState {
    settings: Mutex<SamplerSettings>,
    paused: AtomicBool,
    latest: Mutex<Snapshot>,
    killed: Mutex<HashSet<u32>>,
    demo: bool,
    material: Mutex<String>,
    labels: Mutex<TrayLabels>,
}

impl AppState {
    fn new(demo: bool) -> Self {
        let latest = if demo {
            demo::snapshot_at(48, unix_ms(), &HashSet::new())
        } else {
            empty_snapshot(false)
        };
        Self {
            settings: Mutex::new(SamplerSettings::default()),
            paused: AtomicBool::new(false),
            latest: Mutex::new(latest),
            killed: Mutex::new(HashSet::new()),
            demo,
            material: Mutex::new("solid".into()),
            labels: Mutex::new(TrayLabels::default()),
        }
    }
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|err| err.into_inner())
}

fn demo_enabled() -> bool {
    std::env::args().any(|arg| arg == "--demo")
        || std::env::var("DESKSTATS_DEMO").ok().as_deref() == Some("1")
}

fn unix_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[allow(unused_variables)]
fn apply_material(window: &WebviewWindow, theme: Option<Theme>) -> String {
    #[cfg(target_os = "windows")]
    {
        let effect = match theme {
            Some(Theme::Light) => Effect::MicaLight,
            Some(Theme::Dark) => Effect::MicaDark,
            _ => Effect::Mica,
        };
        let config = EffectsBuilder::new().effect(effect).build();
        if window.set_effects(config).is_ok() {
            return "mica".into();
        }
    }
    #[cfg(target_os = "macos")]
    {
        let config = EffectsBuilder::new()
            .effect(Effect::UnderWindowBackground)
            .state(EffectState::Active)
            .build();
        if window.set_effects(config).is_ok() {
            return "vibrancy".into();
        }
    }
    "solid".into()
}

fn window_is_hidden(app: &AppHandle) -> bool {
    let Some(window) = app.get_webview_window("main") else {
        return true;
    };
    let minimized = window.is_minimized().unwrap_or(false);
    let visible = window.is_visible().unwrap_or(true);
    minimized || !visible
}

fn reveal(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn toggle_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let visible = window.is_visible().unwrap_or(false);
    let minimized = window.is_minimized().unwrap_or(false);
    if visible && !minimized {
        let _ = window.hide();
    } else {
        reveal(app);
    }
}

fn tooltip(snap: &Snapshot, labels: &TrayLabels) -> String {
    if snap.paused {
        return format!("DeskStats  ·  {}", labels.tooltip_paused);
    }
    let cpu = snap.cpu.usage.round() as i32;
    let ram = percent_of(snap.memory.used, snap.memory.total).round() as i32;
    format!(
        "DeskStats  ·  CPU {cpu}%  ·  RAM {ram}% ({})  ·  ↓ {}  ·  up {}",
        format_bytes(snap.memory.used),
        format_rate(snap.network.down_bps),
        format_uptime(snap.system.uptime_secs),
    )
}

fn refresh_tray_menu(app: &AppHandle, state: &AppState) -> tauri::Result<()> {
    let labels = lock(&state.labels).clone();
    let paused = state.paused.load(Ordering::Relaxed);
    let pause_text = if paused {
        &labels.resume
    } else {
        &labels.pause
    };
    let show = MenuItem::with_id(app, "show", &labels.show, true, None::<&str>)?;
    let pause = CheckMenuItem::with_id(app, "pause", pause_text, true, paused, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", &labels.quit, true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &pause, &quit])?;
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_menu(Some(menu))?;
        let snap = lock(&state.latest).clone();
        let _ = tray.set_tooltip(Some(tooltip(&snap, &labels)));
    }
    Ok(())
}

fn spawn_sampler(app: AppHandle, state: Arc<AppState>) {
    std::thread::Builder::new()
        .name("deskstats-sampler".into())
        .spawn(move || {
            let mut collector = if state.demo {
                None
            } else {
                Some(Collector::new())
            };
            let mut demo = DemoEngine::new();
            loop {
                if state.paused.load(Ordering::Relaxed) {
                    let mut snap = lock(&state.latest).clone();
                    snap.paused = true;
                    *lock(&state.latest) = snap.clone();
                    let _ = app.emit("snapshot", &snap);
                    if let Some(tray) = app.tray_by_id("main") {
                        let labels = lock(&state.labels).clone();
                        let _ = tray.set_tooltip(Some(tooltip(&snap, &labels)));
                    }
                    std::thread::sleep(Duration::from_millis(500));
                    continue;
                }

                let settings = lock(&state.settings).clone();
                let interval = effective_interval_ms(
                    settings.interval_ms,
                    window_is_hidden(&app),
                    settings.slow_when_hidden,
                );
                let mut snap = if state.demo {
                    let killed = lock(&state.killed).clone();
                    demo.next(interval, &killed)
                } else if let Some(collector) = collector.as_mut() {
                    collector.sample()
                } else {
                    empty_snapshot(false)
                };
                snap.paused = false;
                *lock(&state.latest) = snap.clone();
                let _ = app.emit("snapshot", &snap);
                if let Some(tray) = app.tray_by_id("main") {
                    let labels = lock(&state.labels).clone();
                    let _ = tray.set_tooltip(Some(tooltip(&snap, &labels)));
                }
                std::thread::sleep(Duration::from_millis(interval));
            }
        })
        .expect("failed to start sampler");
}

#[tauri::command]
fn get_snapshot(state: State<'_, Arc<AppState>>) -> Snapshot {
    lock(&state.latest).clone()
}

#[tauri::command]
fn apply_settings(settings: SamplerSettings, state: State<'_, Arc<AppState>>) {
    let mut slot = lock(&state.settings);
    slot.interval_ms = sanitize_interval(settings.interval_ms);
    slot.slow_when_hidden = settings.slow_when_hidden;
    slot.close_to_tray = settings.close_to_tray;
}

#[tauri::command]
fn set_paused(paused: bool, app: AppHandle, state: State<'_, Arc<AppState>>) {
    state.paused.store(paused, Ordering::Relaxed);
    let _ = refresh_tray_menu(&app, &state);
}

#[tauri::command]
fn kill_process(pid: u32, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    if state.demo {
        lock(&state.killed).insert(pid);
        return Ok(());
    }
    collect::kill_pid(pid)
}

#[tauri::command]
fn host_meta(state: State<'_, Arc<AppState>>) -> HostMeta {
    HostMeta {
        demo: state.demo,
        material: lock(&state.material).clone(),
        os: std::env::consts::OS.into(),
    }
}

#[tauri::command]
fn set_window_theme(theme: String, window: WebviewWindow, state: State<'_, Arc<AppState>>) {
    let parsed = match theme.as_str() {
        "light" => Some(Theme::Light),
        "dark" => Some(Theme::Dark),
        _ => None,
    };
    let _ = window.set_theme(parsed);
    *lock(&state.material) = apply_material(&window, parsed);
}

#[tauri::command]
fn set_tray_labels(labels: TrayLabels, app: AppHandle, state: State<'_, Arc<AppState>>) {
    *lock(&state.labels) = labels;
    let _ = refresh_tray_menu(&app, &state);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let demo = demo_enabled();
    let state = Arc::new(AppState::new(demo));
    tauri::Builder::default()
        .manage(state.clone())
        .setup(move |app| {
            let handle = app.handle().clone();
            if let Some(icon) = app.default_window_icon().cloned() {
                let show =
                    MenuItem::with_id(&handle, "show", "Show DeskStats", true, None::<&str>)?;
                let pause = CheckMenuItem::with_id(
                    &handle,
                    "pause",
                    "Pause sampling",
                    true,
                    false,
                    None::<&str>,
                )?;
                let quit = MenuItem::with_id(&handle, "quit", "Quit", true, None::<&str>)?;
                let menu = Menu::with_items(&handle, &[&show, &pause, &quit])?;
                let tray_state = state.clone();
                TrayIconBuilder::with_id("main")
                    .icon(icon)
                    .tooltip("DeskStats")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(move |app, event| match event.id.as_ref() {
                        "quit" => app.exit(0),
                        "show" => reveal(app),
                        "pause" => {
                            let next = !tray_state.paused.load(Ordering::Relaxed);
                            tray_state.paused.store(next, Ordering::Relaxed);
                            let _ = refresh_tray_menu(app, &tray_state);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            toggle_window(tray.app_handle());
                        }
                    })
                    .build(&handle)?;
            }

            if let Some(window) = app.get_webview_window("main") {
                let material = apply_material(&window, Some(Theme::Dark));
                *lock(&state.material) = material;
                let close_state = state.clone();
                let close_handle = handle.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        if lock(&close_state.settings).close_to_tray {
                            api.prevent_close();
                            if let Some(win) = close_handle.get_webview_window("main") {
                                let _ = win.hide();
                            }
                        }
                    }
                });
            }

            spawn_sampler(handle, state.clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            apply_settings,
            set_paused,
            kill_process,
            host_meta,
            set_window_theme,
            set_tray_labels
        ])
        .run(tauri::generate_context!())
        .expect("error while running DeskStats");
}
