use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub timestamp_ms: u64,
    pub demo: bool,
    pub paused: bool,
    pub cpu: CpuInfo,
    pub memory: MemoryInfo,
    pub gpus: Vec<GpuInfo>,
    pub disks: Vec<DiskInfo>,
    pub network: NetworkInfo,
    pub battery: Option<BatteryInfo>,
    pub temperatures: Vec<TempInfo>,
    pub system: SystemInfo,
    pub processes: Vec<ProcessInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuInfo {
    pub usage: f32,
    pub frequency_mhz: u64,
    pub brand: String,
    pub physical_cores: usize,
    pub logical_cores: usize,
    pub cores: Vec<CoreInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoreInfo {
    pub id: usize,
    pub usage: f32,
    pub frequency_mhz: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryInfo {
    pub total: u64,
    pub used: u64,
    pub available: u64,
    pub swap_total: u64,
    pub swap_used: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GpuInfo {
    pub name: String,
    pub vendor: String,
    pub usage: Option<f32>,
    pub memory_total: Option<u64>,
    pub memory_used: Option<u64>,
    pub temperature_c: Option<f32>,
    pub power_watts: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskInfo {
    pub name: String,
    pub mount: String,
    pub kind: String,
    pub total: u64,
    pub used: u64,
    pub read_bps: u64,
    pub write_bps: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NicInfo {
    pub name: String,
    pub down_bps: u64,
    pub up_bps: u64,
    pub total_down: u64,
    pub total_up: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInfo {
    pub interface_name: String,
    pub down_bps: u64,
    pub up_bps: u64,
    pub total_down: u64,
    pub total_up: u64,
    pub interfaces: Vec<NicInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatteryInfo {
    pub percent: f32,
    pub state: String,
    pub secs_remaining: Option<u64>,
    pub power_watts: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TempInfo {
    pub label: String,
    pub celsius: f32,
    pub critical: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub hostname: String,
    pub os: String,
    pub kernel: String,
    pub arch: String,
    pub cpu_brand: String,
    pub uptime_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu: f32,
    pub memory: u64,
    pub user: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SamplerSettings {
    pub interval_ms: u64,
    pub slow_when_hidden: bool,
    pub close_to_tray: bool,
}

impl Default for SamplerSettings {
    fn default() -> Self {
        Self {
            interval_ms: 1000,
            slow_when_hidden: true,
            close_to_tray: true,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostMeta {
    pub demo: bool,
    pub material: String,
    pub os: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayLabels {
    pub show: String,
    pub pause: String,
    pub resume: String,
    pub quit: String,
    pub tooltip_paused: String,
}

impl Default for TrayLabels {
    fn default() -> Self {
        Self {
            show: "Show DeskStats".into(),
            pause: "Pause sampling".into(),
            resume: "Resume sampling".into(),
            quit: "Quit".into(),
            tooltip_paused: "Paused".into(),
        }
    }
}

pub fn empty_snapshot(demo: bool) -> Snapshot {
    Snapshot {
        timestamp_ms: 0,
        demo,
        paused: false,
        cpu: CpuInfo {
            usage: 0.0,
            frequency_mhz: 0,
            brand: String::new(),
            physical_cores: 0,
            logical_cores: 0,
            cores: Vec::new(),
        },
        memory: MemoryInfo {
            total: 0,
            used: 0,
            available: 0,
            swap_total: 0,
            swap_used: 0,
        },
        gpus: Vec::new(),
        disks: Vec::new(),
        network: NetworkInfo {
            interface_name: String::new(),
            down_bps: 0,
            up_bps: 0,
            total_down: 0,
            total_up: 0,
            interfaces: Vec::new(),
        },
        battery: None,
        temperatures: Vec::new(),
        system: SystemInfo {
            hostname: String::new(),
            os: String::new(),
            kernel: String::new(),
            arch: String::new(),
            cpu_brand: String::new(),
            uptime_secs: 0,
        },
        processes: Vec::new(),
    }
}
