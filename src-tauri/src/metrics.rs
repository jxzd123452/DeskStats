use crate::model::{GpuInfo, NicInfo};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
pub enum Level {
    Ok,
    Warn,
    Crit,
}

pub fn finite32(value: f32) -> f32 {
    if value.is_finite() {
        value
    } else {
        0.0
    }
}

pub fn clamp_percent(value: f32) -> f32 {
    finite32(value).clamp(0.0, 100.0)
}

/// sysinfo reports per-process CPU as a sum across logical processors
/// (100 ≈ one fully busy core). Divide so the UI matches Task Manager,
/// where every process is a share of the whole machine.
pub fn normalize_process_cpu(raw: f32, logical_cores: usize) -> f32 {
    let raw = finite32(raw);
    if raw <= 0.0 {
        return 0.0;
    }
    let cores = logical_cores.max(1) as f32;
    (raw / cores).clamp(0.0, 100.0)
}

pub fn sanitize_interval(interval_ms: u64) -> u64 {
    match interval_ms {
        500 | 1000 | 2000 | 5000 => interval_ms,
        _ => 1000,
    }
}

pub fn effective_interval_ms(interval_ms: u64, hidden: bool, slow_when_hidden: bool) -> u64 {
    let base = sanitize_interval(interval_ms);
    if hidden && slow_when_hidden {
        base.saturating_mul(4).max(2_000)
    } else {
        base
    }
}

pub fn bytes_per_sec(delta_bytes: u64, elapsed_secs: f64) -> u64 {
    if !elapsed_secs.is_finite() || elapsed_secs <= 0.0 {
        return 0;
    }
    (delta_bytes as f64 / elapsed_secs).round().max(0.0) as u64
}

pub fn used_bytes(total: u64, available: u64) -> u64 {
    total.saturating_sub(available.min(total))
}

#[allow(dead_code)]
pub fn usage_level(percent: f32) -> Level {
    let percent = finite32(percent);
    if percent >= 90.0 {
        Level::Crit
    } else if percent >= 75.0 {
        Level::Warn
    } else {
        Level::Ok
    }
}

#[allow(dead_code)]
pub fn temp_level(celsius: f32) -> Level {
    let celsius = finite32(celsius);
    if celsius >= 95.0 {
        Level::Crit
    } else if celsius >= 85.0 {
        Level::Warn
    } else {
        Level::Ok
    }
}

pub fn is_loopback(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    n == "lo" || n == "lo0" || n.contains("loopback")
}

pub fn is_virtual_nic(name: &str) -> bool {
    if is_loopback(name) {
        return true;
    }
    let n = name.to_ascii_lowercase();
    n.starts_with("docker")
        || n.starts_with("veth")
        || n.starts_with("br-")
        || n.starts_with("virbr")
        || n.starts_with("vmnet")
        || n.contains("bluetooth")
        || n.starts_with("tun")
        || n.starts_with("tap")
}

pub fn keep_mount(mount: &str, total: u64) -> bool {
    if mount.is_empty() || total < 1024 * 1024 * 1024 {
        return false;
    }
    let m = mount.replace('\\', "/");
    const SKIP_PREFIXES: &[&str] = &[
        "/proc",
        "/sys",
        "/dev",
        "/run",
        "/snap",
        "/var/lib/docker",
        "/var/snap",
        "/boot",
    ];
    !SKIP_PREFIXES
        .iter()
        .any(|prefix| m == *prefix || m.starts_with(&format!("{prefix}/")))
}

pub fn primary_interface(nics: &[NicInfo]) -> Option<&NicInfo> {
    nics.iter()
        .filter(|nic| !is_virtual_nic(&nic.name))
        .max_by(|a, b| {
            let rate_a = a.down_bps.saturating_add(a.up_bps);
            let rate_b = b.down_bps.saturating_add(b.up_bps);
            rate_a
                .cmp(&rate_b)
                .then_with(|| a.total_down.cmp(&b.total_down))
                .then_with(|| a.name.cmp(&b.name))
        })
}

pub fn is_nvidia(vendor: &str, name: &str) -> bool {
    let blob = format!("{} {}", vendor, name).to_ascii_lowercase();
    blob.contains("nvidia")
        || blob.contains("geforce")
        || blob.contains("quadro")
        || blob.contains("rtx ")
        || blob.contains("gtx ")
}

fn overlay(slot: &mut GpuInfo, extra: GpuInfo) {
    if slot.name.trim().is_empty() || slot.name.eq_ignore_ascii_case("gpu") {
        slot.name = extra.name;
    }
    if slot.vendor.trim().is_empty() && !extra.vendor.is_empty() {
        slot.vendor = extra.vendor;
    }
    if extra.usage.is_some() {
        slot.usage = extra.usage;
    }
    if extra.memory_total.is_some() {
        slot.memory_total = extra.memory_total;
    }
    if extra.memory_used.is_some() {
        slot.memory_used = extra.memory_used;
    }
    if extra.temperature_c.is_some() {
        slot.temperature_c = extra.temperature_c;
    }
    if extra.power_watts.is_some() {
        slot.power_watts = extra.power_watts;
    }
}

/// Fold NVML readings onto sysinfo GPUs. NVIDIA cards are matched in order;
/// anything left over is appended so a missing sysinfo entry still shows up.
pub fn merge_gpu_sources(mut base: Vec<GpuInfo>, nvml: Vec<GpuInfo>) -> Vec<GpuInfo> {
    let mut extras = nvml.into_iter().peekable();
    for gpu in &mut base {
        if is_nvidia(&gpu.vendor, &gpu.name) {
            if let Some(extra) = extras.next() {
                overlay(gpu, extra);
            }
        }
    }
    base.extend(extras);
    base
}

pub fn format_bytes(bytes: u64) -> String {
    const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    let mut value = bytes as f64;
    let mut unit = 0;
    while value >= 1024.0 && unit < UNITS.len() - 1 {
        value /= 1024.0;
        unit += 1;
    }
    if unit == 0 {
        return format!("{bytes} {}", UNITS[0]);
    }
    format_unit(value, UNITS[unit])
}

pub fn format_rate(bytes_per_second: u64) -> String {
    format!("{}/s", format_bytes(bytes_per_second))
}

fn format_unit(value: f64, unit: &str) -> String {
    if value >= 100.0 {
        format!("{value:.0} {unit}")
    } else if value >= 10.0 {
        format!("{value:.1} {unit}")
    } else {
        format!("{value:.2} {unit}")
    }
}

pub fn format_uptime(secs: u64) -> String {
    let days = secs / 86_400;
    let hours = (secs % 86_400) / 3_600;
    let mins = (secs % 3_600) / 60;
    if days > 0 {
        format!("{days}d {hours}h {mins}m")
    } else if hours > 0 {
        format!("{hours}h {mins}m")
    } else {
        format!("{mins}m")
    }
}

pub fn percent_of(used: u64, total: u64) -> f32 {
    if total == 0 {
        0.0
    } else {
        clamp_percent((used as f64 / total as f64 * 100.0) as f32)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::NicInfo;

    fn nic(name: &str, down: u64, up: u64, total_down: u64) -> NicInfo {
        NicInfo {
            name: name.into(),
            down_bps: down,
            up_bps: up,
            total_down,
            total_up: 0,
        }
    }

    #[test]
    fn clamps_non_finite_percentages() {
        assert_eq!(clamp_percent(f32::NAN), 0.0);
        assert_eq!(clamp_percent(-4.0), 0.0);
        assert_eq!(clamp_percent(140.0), 100.0);
        assert!((clamp_percent(42.5) - 42.5).abs() < f32::EPSILON);
    }

    #[test]
    fn normalizes_process_cpu_across_cores() {
        assert!((normalize_process_cpu(200.0, 8) - 25.0).abs() < 0.001);
        assert!((normalize_process_cpu(50.0, 1) - 50.0).abs() < 0.001);
        assert_eq!(normalize_process_cpu(-1.0, 8), 0.0);
        assert_eq!(normalize_process_cpu(f32::INFINITY, 4), 0.0);
        assert!((normalize_process_cpu(10_000.0, 4) - 100.0).abs() < 0.001);
    }

    #[test]
    fn interval_falls_back_and_slows_when_hidden() {
        assert_eq!(sanitize_interval(750), 1000);
        assert_eq!(sanitize_interval(500), 500);
        assert_eq!(effective_interval_ms(500, false, true), 500);
        assert_eq!(effective_interval_ms(500, true, true), 2000);
        assert_eq!(effective_interval_ms(2000, true, true), 8000);
        assert_eq!(effective_interval_ms(1000, true, false), 1000);
    }

    #[test]
    fn rate_uses_elapsed_time() {
        assert_eq!(bytes_per_sec(1_500, 1.5), 1_000);
        assert_eq!(bytes_per_sec(100, 0.0), 0);
        assert_eq!(bytes_per_sec(100, f64::NAN), 0);
    }

    #[test]
    fn used_space_never_exceeds_total() {
        assert_eq!(used_bytes(100, 40), 60);
        assert_eq!(used_bytes(100, 140), 0);
        assert_eq!(used_bytes(0, 0), 0);
    }

    #[test]
    fn levels_follow_thresholds() {
        assert_eq!(usage_level(74.9), Level::Ok);
        assert_eq!(usage_level(75.0), Level::Warn);
        assert_eq!(usage_level(90.0), Level::Crit);
        assert_eq!(temp_level(84.0), Level::Ok);
        assert_eq!(temp_level(85.0), Level::Warn);
        assert_eq!(temp_level(95.0), Level::Crit);
    }

    #[test]
    fn primary_nic_skips_virtual_adapters() {
        let nics = vec![
            nic("lo", 9_000, 9_000, 999),
            nic("docker0", 5_000, 5_000, 50),
            nic("Wi-Fi", 2_000, 100, 10),
            nic("Ethernet", 100, 100, 80_000_000),
        ];
        let primary = primary_interface(&nics).unwrap();
        assert_eq!(primary.name, "Wi-Fi");
    }

    #[test]
    fn primary_nic_uses_totals_when_idle() {
        let nics = vec![
            nic("lo", 0, 0, 10),
            nic("en0", 0, 0, 50),
            nic("en1", 0, 0, 20),
        ];
        assert_eq!(primary_interface(&nics).unwrap().name, "en0");
        assert!(primary_interface(&[]).is_none());
    }

    #[test]
    fn filters_tiny_and_virtual_mounts() {
        assert!(!keep_mount("/proc", 10_000_000_000));
        assert!(!keep_mount("/snap/core/1", 10_000_000_000));
        assert!(!keep_mount("D:\\", 200_000_000));
        assert!(keep_mount("C:\\", 500_000_000_000));
        assert!(keep_mount("/home", 2_000_000_000));
    }

    #[test]
    fn merges_nvml_onto_matching_nvidia_gpu() {
        let base = vec![GpuInfo {
            name: "NVIDIA GeForce RTX 4070".into(),
            vendor: "NVIDIA".into(),
            usage: Some(10.0),
            memory_total: Some(100),
            memory_used: Some(20),
            temperature_c: None,
            power_watts: None,
        }];
        let nvml = vec![GpuInfo {
            name: "NVIDIA GeForce RTX 4070".into(),
            vendor: "NVIDIA".into(),
            usage: Some(36.0),
            memory_total: Some(12_884_901_888),
            memory_used: Some(4_294_967_296),
            temperature_c: Some(64.0),
            power_watts: Some(89.0),
        }];
        let merged = merge_gpu_sources(base, nvml);
        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].usage, Some(36.0));
        assert_eq!(merged[0].temperature_c, Some(64.0));
        assert_eq!(merged[0].power_watts, Some(89.0));
    }

    #[test]
    fn appends_nvml_when_sysinfo_has_no_gpu() {
        let nvml = vec![GpuInfo {
            name: "NVIDIA GeForce RTX 4070".into(),
            vendor: "NVIDIA".into(),
            usage: Some(12.0),
            memory_total: Some(1),
            memory_used: Some(1),
            temperature_c: Some(40.0),
            power_watts: Some(20.0),
        }];
        let merged = merge_gpu_sources(Vec::new(), nvml);
        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].name, "NVIDIA GeForce RTX 4070");
    }

    #[test]
    fn formats_bytes_and_rates() {
        assert_eq!(format_bytes(512), "512 B");
        assert_eq!(format_bytes(1536), "1.50 KB");
        assert_eq!(format_bytes(1024 * 1024 * 12), "12.0 MB");
        assert_eq!(format_rate(1024 * 1024), "1.00 MB/s");
        assert_eq!(format_uptime(86_400 + 3_600 * 2 + 60), "1d 2h 1m");
        assert_eq!(format_uptime(120), "2m");
        assert_eq!(format_uptime(3_700), "1h 1m");
    }

    #[test]
    fn percent_of_empty_total_is_zero() {
        assert_eq!(percent_of(5, 0), 0.0);
        assert!((percent_of(25, 100) - 25.0).abs() < 0.001);
    }
}
