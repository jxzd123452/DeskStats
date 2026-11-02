use std::collections::HashSet;

use crate::metrics::clamp_percent;
use crate::model::{
    BatteryInfo, CoreInfo, CpuInfo, DiskInfo, GpuInfo, MemoryInfo, NetworkInfo, NicInfo,
    ProcessInfo, Snapshot, SystemInfo, TempInfo,
};

const GIB: u64 = 1024 * 1024 * 1024;

#[derive(Debug, Clone)]
struct ProcSeed {
    pid: u32,
    name: &'static str,
    user: &'static str,
    cpu: f32,
    memory: u64,
}

const PROCS: &[ProcSeed] = &[
    ProcSeed {
        pid: 18420,
        name: "Cursor",
        user: "aurora",
        cpu: 9.4,
        memory: 1_760_000_000,
    },
    ProcSeed {
        pid: 4412,
        name: "chrome",
        user: "aurora",
        cpu: 6.6,
        memory: 2_480_000_000,
    },
    ProcSeed {
        pid: 2204,
        name: "Code",
        user: "aurora",
        cpu: 4.1,
        memory: 934_000_000,
    },
    ProcSeed {
        pid: 9088,
        name: "WindowsTerminal",
        user: "aurora",
        cpu: 3.4,
        memory: 196_000_000,
    },
    ProcSeed {
        pid: 3310,
        name: "Discord",
        user: "aurora",
        cpu: 2.3,
        memory: 540_000_000,
    },
    ProcSeed {
        pid: 7741,
        name: "MsMpEng",
        user: "SYSTEM",
        cpu: 2.0,
        memory: 286_000_000,
    },
    ProcSeed {
        pid: 5120,
        name: "slack",
        user: "aurora",
        cpu: 1.5,
        memory: 668_000_000,
    },
    ProcSeed {
        pid: 6402,
        name: "Spotify",
        user: "aurora",
        cpu: 1.1,
        memory: 334_000_000,
    },
    ProcSeed {
        pid: 1180,
        name: "steamwebhelper",
        user: "aurora",
        cpu: 0.9,
        memory: 248_000_000,
    },
    ProcSeed {
        pid: 860,
        name: "dwm",
        user: "aurora",
        cpu: 0.8,
        memory: 102_000_000,
    },
    ProcSeed {
        pid: 2104,
        name: "svchost",
        user: "SYSTEM",
        cpu: 0.7,
        memory: 92_000_000,
    },
    ProcSeed {
        pid: 4012,
        name: "explorer",
        user: "aurora",
        cpu: 0.6,
        memory: 148_000_000,
    },
    ProcSeed {
        pid: 1555,
        name: "OneDrive",
        user: "aurora",
        cpu: 0.4,
        memory: 172_000_000,
    },
    ProcSeed {
        pid: 990,
        name: "SearchHost",
        user: "aurora",
        cpu: 0.3,
        memory: 124_000_000,
    },
    ProcSeed {
        pid: 720,
        name: "audiodg",
        user: "LOCAL SERVICE",
        cpu: 0.2,
        memory: 28_000_000,
    },
    ProcSeed {
        pid: 4,
        name: "System",
        user: "SYSTEM",
        cpu: 0.3,
        memory: 12_000_000,
    },
];

#[derive(Debug)]
pub struct DemoEngine {
    tick: u64,
    origin_ms: u64,
}

impl Default for DemoEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl DemoEngine {
    pub fn new() -> Self {
        Self {
            tick: 48,
            origin_ms: 1_762_000_000_000,
        }
    }

    pub fn next(&mut self, interval_ms: u64, killed: &HashSet<u32>) -> Snapshot {
        let snap = snapshot_at(self.tick, self.origin_ms + self.tick * 1000, killed);
        self.tick = self.tick.saturating_add(1);
        let _ = interval_ms;
        snap
    }
}

pub fn snapshot_at(tick: u64, timestamp_ms: u64, killed: &HashSet<u32>) -> Snapshot {
    let t = tick as f64;
    let cpu = clamp_percent(cpu_wave(t));
    let logical = 8usize;
    let cores = (0..logical)
        .map(|id| {
            let bias = [0.62, 0.9, 1.42, 1.18, 0.74, 1.05, 0.48, 1.28][id];
            let wobble = 1.0 + 0.07 * (t * 0.21 + id as f64).sin();
            CoreInfo {
                id,
                usage: clamp_percent((cpu as f64 * bias * wobble) as f32),
                frequency_mhz: 4200 + ((t * 0.3 + id as f64).sin() * 280.0) as u64,
            }
        })
        .collect::<Vec<_>>();
    let core_avg = cores.iter().map(|c| c.usage).sum::<f32>() / logical as f32;
    let scale = if core_avg > 0.1 { cpu / core_avg } else { 1.0 };
    let cores = cores
        .into_iter()
        .map(|mut core| {
            core.usage = clamp_percent(core.usage * scale);
            core
        })
        .collect::<Vec<_>>();

    let mem_total = 32 * GIB;
    let mem_pct = (0.586 + (t * 0.012).sin() * 0.012).clamp(0.4, 0.9);
    let mem_used = (mem_total as f64 * mem_pct) as u64;
    let swap_total = 8 * GIB;
    let swap_used = (swap_total as f64 * 0.06) as u64;

    let gpu_usage = clamp_percent(gpu_wave(t));
    let vram_total = 12 * GIB;
    let vram_used = (vram_total as f64 * (0.34 + (t * 0.02).sin() * 0.03)) as u64;

    let down = down_bps(t);
    let up = up_bps(t);

    let mut processes: Vec<ProcessInfo> = PROCS
        .iter()
        .filter(|p| !killed.contains(&p.pid))
        .map(|p| {
            let wobble = 1.0 + 0.04 * (t * 0.17 + p.pid as f64).sin();
            ProcessInfo {
                pid: p.pid,
                name: p.name.into(),
                cpu: clamp_percent(p.cpu * wobble as f32),
                memory: p.memory,
                user: p.user.into(),
            }
        })
        .collect();
    processes.sort_by(|a, b| {
        b.cpu
            .partial_cmp(&a.cpu)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Snapshot {
        timestamp_ms,
        demo: true,
        paused: false,
        cpu: CpuInfo {
            usage: cpu,
            frequency_mhz: cores.iter().map(|c| c.frequency_mhz).max().unwrap_or(0),
            brand: "AMD Ryzen 7 7800X3D".into(),
            physical_cores: 8,
            logical_cores: logical,
            cores,
        },
        memory: MemoryInfo {
            total: mem_total,
            used: mem_used,
            available: mem_total.saturating_sub(mem_used),
            swap_total,
            swap_used,
        },
        gpus: vec![GpuInfo {
            name: "NVIDIA GeForce RTX 4070".into(),
            vendor: "NVIDIA".into(),
            usage: Some(gpu_usage),
            memory_total: Some(vram_total),
            memory_used: Some(vram_used),
            temperature_c: Some(clamp_percent(58.0 + gpu_usage * 0.18)),
            power_watts: Some(42.0 + gpu_usage * 1.35),
        }],
        disks: vec![
            DiskInfo {
                name: "Samsung 990 PRO".into(),
                mount: "C:\\".into(),
                kind: "SSD".into(),
                total: GIB * 1000,
                used: (GIB as f64 * 612.0) as u64,
                read_bps: disk_read(t),
                write_bps: disk_write(t) / 3,
            },
            DiskInfo {
                name: "WD Black SN850X".into(),
                mount: "D:\\".into(),
                kind: "SSD".into(),
                total: GIB * 2000,
                used: (GIB as f64 * 804.0) as u64,
                read_bps: disk_read(t) / 8 + 180_000,
                write_bps: disk_write(t) / 2,
            },
        ],
        network: NetworkInfo {
            interface_name: "Wi-Fi".into(),
            down_bps: down,
            up_bps: up,
            total_down: 86 * GIB + (tick * 400_000),
            total_up: 12 * GIB + (tick * 40_000),
            interfaces: vec![
                NicInfo {
                    name: "Wi-Fi".into(),
                    down_bps: down,
                    up_bps: up,
                    total_down: 86 * GIB,
                    total_up: 12 * GIB,
                },
                NicInfo {
                    name: "Ethernet".into(),
                    down_bps: 0,
                    up_bps: 0,
                    total_down: 2 * GIB,
                    total_up: GIB / 2,
                },
            ],
        },
        battery: Some(BatteryInfo {
            percent: 76.0,
            state: "charging".into(),
            secs_remaining: Some(72 * 60),
            power_watts: Some(38.4),
        }),
        temperatures: vec![
            TempInfo {
                label: "CPU Package".into(),
                celsius: 54.0 + cpu * 0.22,
                critical: Some(95.0),
            },
            TempInfo {
                label: "GPU".into(),
                celsius: 58.0 + gpu_usage * 0.18,
                critical: Some(93.0),
            },
            TempInfo {
                label: "NVMe".into(),
                celsius: 41.0 + (t * 0.05).sin() as f32,
                critical: Some(85.0),
            },
        ],
        system: SystemInfo {
            hostname: "AURORA".into(),
            os: "Windows 11 Pro".into(),
            kernel: "10.0.26100".into(),
            arch: "x86_64".into(),
            cpu_brand: "AMD Ryzen 7 7800X3D".into(),
            uptime_secs: 2 * 86_400 + 14 * 3_600 + 22 * 60,
        },
        processes,
    }
}

fn cpu_wave(t: f64) -> f32 {
    let a = (t * 0.085).sin() * 8.0;
    let b = (t * 0.023 + 1.2).sin() * 6.0;
    let c = (t * 0.21 + 0.4).sin() * 3.2;
    let phase = (t % 55.0) - 28.0;
    let hill = (-(phase * phase) / 90.0).exp() * 12.0;
    (34.0 + a + b + c + hill) as f32
}

fn gpu_wave(t: f64) -> f32 {
    let bump = if (t % 40.0) > 30.0 { 10.0 } else { 0.0 };
    (30.0 + (t * 0.06).sin() * 9.0 + (t * 0.19).sin() * 5.0 + bump) as f32
}

fn down_bps(t: f64) -> u64 {
    let base = 5_400_000.0 + (t * 0.09).sin() * 2_200_000.0 + (t * 0.031 + 0.7).sin() * 1_600_000.0;
    let phase = (t % 32.0) - 14.0;
    let burst = (-(phase * phase) / 28.0).exp() * 4_800_000.0;
    (base + burst).max(900_000.0) as u64
}

fn up_bps(t: f64) -> u64 {
    let base = 780_000.0 + (t * 0.13 + 1.1).sin() * 280_000.0 + (t * 0.041).sin() * 220_000.0;
    let phase = (t % 32.0) - 20.0;
    let burst = (-(phase * phase) / 22.0).exp() * 1_400_000.0;
    (base + burst).max(180_000.0) as u64
}

fn disk_read(t: f64) -> u64 {
    (1_200_000.0 + (t * 0.11).sin().abs() * 18_000_000.0) as u64
}

fn disk_write(t: f64) -> u64 {
    (400_000.0 + (t * 0.07 + 1.0).sin().abs() * 4_000_000.0) as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn demo_is_deterministic_and_bounded() {
        let killed = HashSet::new();
        let a = snapshot_at(48, 1000, &killed);
        let b = snapshot_at(48, 1000, &killed);
        assert_eq!(a.cpu.usage.to_bits(), b.cpu.usage.to_bits());
        assert_eq!(a.cpu.cores.len(), 8);
        assert!(a.cpu.usage > 5.0 && a.cpu.usage < 95.0);
        assert!(a.memory.used <= a.memory.total);
        assert!(a.memory.swap_used <= a.memory.swap_total);
        assert_eq!(a.gpus.len(), 1);
        assert!(a.gpus[0].temperature_c.unwrap() > 0.0);
        assert_eq!(a.disks.len(), 2);
        assert!(a.battery.is_some());
        assert_eq!(a.temperatures.len(), 3);
        assert!(!a.processes.is_empty());
        let mut cpus = a.processes.iter().map(|p| p.cpu);
        let first = cpus.next().unwrap();
        assert!(cpus.all(|c| c <= first + 0.001));
        let avg = a.cpu.cores.iter().map(|c| c.usage).sum::<f32>() / 8.0;
        assert!((avg - a.cpu.usage).abs() < 1.5);
    }

    #[test]
    fn killed_processes_disappear() {
        let mut killed = HashSet::new();
        killed.insert(4412);
        let snap = snapshot_at(10, 0, &killed);
        assert!(snap.processes.iter().all(|p| p.pid != 4412));
        assert!(snap.processes.len() + 1 == PROCS.len());
    }

    #[test]
    fn engine_advances() {
        let mut engine = DemoEngine::new();
        let first = engine.next(1000, &HashSet::new());
        let second = engine.next(1000, &HashSet::new());
        assert!(second.timestamp_ms > first.timestamp_ms);
        assert!(second.demo);
    }

    #[test]
    fn json_contract_uses_camel_case() {
        let snap = snapshot_at(3, 42, &HashSet::new());
        let value = serde_json::to_value(&snap).unwrap();
        assert_eq!(value["timestampMs"], 42);
        assert!(value["cpu"]["frequencyMhz"].is_number());
        assert!(value["memory"]["swapTotal"].is_number());
        assert!(value["network"]["downBps"].is_number());
        assert!(value["network"]["interfaceName"].is_string());
        assert!(value["processes"][0]["pid"].is_number());
        assert!(value["system"]["uptimeSecs"].is_number());
        assert!(value.get("timestamp_ms").is_none());
    }
}
