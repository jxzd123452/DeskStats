use std::time::Instant;

use sysinfo::{
    Components, CpuRefreshKind, DiskRefreshKind, Disks, Gpus, MemoryRefreshKind, Networks, Pid,
    ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind, Users,
};

use crate::gpu_nvml;
use crate::metrics::{
    bytes_per_sec, clamp_percent, finite32, is_virtual_nic, keep_mount, merge_gpu_sources,
    normalize_process_cpu, primary_interface, used_bytes,
};
use crate::model::{
    BatteryInfo, CoreInfo, CpuInfo, DiskInfo, GpuInfo, MemoryInfo, NetworkInfo, NicInfo,
    ProcessInfo, Snapshot, SystemInfo, TempInfo,
};

pub struct Collector {
    inner: Option<Live>,
}

struct Live {
    sys: System,
    disks: Disks,
    networks: Networks,
    components: Components,
    gpus: Option<Gpus>,
    users: Users,
    last: Instant,
    primed: bool,
    user_tick: u32,
}

impl Collector {
    pub fn new() -> Self {
        match Live::open() {
            Ok(inner) => Self { inner: Some(inner) },
            Err(err) => {
                eprintln!("deskstats: collector unavailable ({err})");
                Self { inner: None }
            }
        }
    }

    pub fn sample(&mut self) -> Snapshot {
        match self.inner.as_mut() {
            Some(live) => live.sample(),
            None => Snapshot {
                demo: false,
                ..crate::model::empty_snapshot(false)
            },
        }
    }
}

impl Live {
    fn open() -> Result<Self, sysinfo::Error> {
        let mut sys = System::new_all()?;
        sys.refresh_cpu_specifics(CpuRefreshKind::everything());
        std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
        sys.refresh_cpu_specifics(CpuRefreshKind::everything());
        sys.refresh_memory_specifics(MemoryRefreshKind::everything());
        let disks = Disks::new_with_refreshed_list_specifics(DiskRefreshKind::everything())?;
        let networks = Networks::new_with_refreshed_list()?;
        let components = Components::new_with_refreshed_list()?;
        let gpus = Gpus::new_with_refreshed_list().ok();
        let users = Users::new_with_refreshed_list()?;
        Ok(Self {
            sys,
            disks,
            networks,
            components,
            gpus,
            users,
            last: Instant::now(),
            primed: false,
            user_tick: 0,
        })
    }

    fn sample(&mut self) -> Snapshot {
        let elapsed = self.last.elapsed().as_secs_f64().max(0.05);
        self.last = Instant::now();

        self.sys.refresh_cpu_specifics(CpuRefreshKind::everything());
        self.sys
            .refresh_memory_specifics(MemoryRefreshKind::everything());
        let _ = self.sys.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing()
                .with_cpu()
                .with_memory()
                .with_user(UpdateKind::OnlyIfNotSet),
        );
        self.disks
            .refresh_specifics(true, DiskRefreshKind::everything());
        self.networks.refresh(true);
        self.components.refresh(false);
        if let Some(gpus) = self.gpus.as_mut() {
            gpus.refresh(false);
        }
        self.user_tick = self.user_tick.wrapping_add(1);
        if self.user_tick.is_multiple_of(15) {
            self.users.refresh();
        }

        let rates_ready = self.primed;
        self.primed = true;

        let logical = self.sys.cpus().len();
        let cores: Vec<CoreInfo> = self
            .sys
            .cpus()
            .iter()
            .enumerate()
            .map(|(id, cpu)| CoreInfo {
                id,
                usage: clamp_percent(cpu.usage()),
                frequency_mhz: cpu.frequency(),
            })
            .collect();
        let frequency_mhz = cores.iter().map(|c| c.frequency_mhz).max().unwrap_or(0);
        let brand = self
            .sys
            .cpus()
            .first()
            .map(|cpu| cpu.brand().trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "CPU".into());
        let physical = System::physical_core_count().unwrap_or(logical.max(1));

        let memory = MemoryInfo {
            total: self.sys.total_memory(),
            used: self.sys.used_memory(),
            available: self.sys.available_memory(),
            swap_total: self.sys.total_swap(),
            swap_used: self.sys.used_swap(),
        };

        let mut disks = Vec::new();
        for disk in self.disks.iter() {
            let mount = disk.mount_point().to_string_lossy().to_string();
            let total = disk.total_space();
            if !keep_mount(&mount, total) {
                continue;
            }
            let usage = disk.usage();
            let (read_bps, write_bps) = if rates_ready {
                (
                    bytes_per_sec(usage.read_bytes, elapsed),
                    bytes_per_sec(usage.written_bytes, elapsed),
                )
            } else {
                (0, 0)
            };
            disks.push(DiskInfo {
                name: lossy_label(disk.name(), &mount),
                mount,
                kind: disk.kind().to_string(),
                total,
                used: used_bytes(total, disk.available_space()),
                read_bps,
                write_bps,
            });
        }
        disks.sort_by(|a, b| a.mount.cmp(&b.mount));

        let mut interfaces = Vec::new();
        for (name, data) in self.networks.iter() {
            let name = name.to_string_lossy().to_string();
            if is_virtual_nic(&name) {
                continue;
            }
            let (down_bps, up_bps) = if rates_ready {
                (
                    bytes_per_sec(data.received(), elapsed),
                    bytes_per_sec(data.transmitted(), elapsed),
                )
            } else {
                (0, 0)
            };
            interfaces.push(NicInfo {
                name,
                down_bps,
                up_bps,
                total_down: data.total_received(),
                total_up: data.total_transmitted(),
            });
        }
        let primary = primary_interface(&interfaces).cloned();
        let network = match primary {
            Some(nic) => NetworkInfo {
                interface_name: nic.name.clone(),
                down_bps: nic.down_bps,
                up_bps: nic.up_bps,
                total_down: nic.total_down,
                total_up: nic.total_up,
                interfaces,
            },
            None => NetworkInfo {
                interface_name: String::new(),
                down_bps: 0,
                up_bps: 0,
                total_down: 0,
                total_up: 0,
                interfaces,
            },
        };

        let mut temperatures = Vec::new();
        for component in self.components.iter() {
            if let Some(celsius) = component.temperature() {
                if !celsius.is_finite() {
                    continue;
                }
                temperatures.push(TempInfo {
                    label: component.label().to_string(),
                    celsius,
                    critical: component.critical().filter(|c| c.is_finite()),
                });
            }
        }

        let mut gpus = Vec::new();
        if let Some(list) = self.gpus.as_ref() {
            for gpu in list.iter() {
                let name = gpu.model().unwrap_or("GPU").trim().to_string();
                let vendor = gpu.vendor().unwrap_or("").trim().to_string();
                gpus.push(GpuInfo {
                    name,
                    vendor,
                    usage: gpu.usage().map(clamp_percent),
                    memory_total: gpu.total_memory(),
                    memory_used: gpu.used_memory(),
                    temperature_c: None,
                    power_watts: None,
                });
            }
        }
        gpus = merge_gpu_sources(gpus, gpu_nvml::read_nvidia());
        for gpu in &gpus {
            if let Some(temp) = gpu.temperature_c {
                let exists = temperatures
                    .iter()
                    .any(|t| t.label.eq_ignore_ascii_case("GPU"));
                if !exists {
                    temperatures.push(TempInfo {
                        label: "GPU".into(),
                        celsius: temp,
                        critical: None,
                    });
                }
            }
        }

        let mut processes = Vec::new();
        for process in self.sys.processes().values() {
            let name = process.name().to_string_lossy().trim().to_string();
            if name.is_empty() {
                continue;
            }
            let user = process
                .user_id()
                .and_then(|uid| self.users.get_user_by_id(uid))
                .map(|user| user.name().to_string())
                .unwrap_or_else(|| "—".into());
            processes.push(ProcessInfo {
                pid: process.pid().as_u32(),
                name,
                cpu: normalize_process_cpu(process.cpu_usage(), logical),
                memory: process.memory(),
                user,
            });
        }
        processes.sort_by(|a, b| {
            b.cpu
                .partial_cmp(&a.cpu)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then(b.memory.cmp(&a.memory))
        });
        processes.truncate(250);

        Snapshot {
            timestamp_ms: unix_ms(),
            demo: false,
            paused: false,
            cpu: CpuInfo {
                usage: clamp_percent(finite32(self.sys.global_cpu_usage())),
                frequency_mhz,
                brand: brand.clone(),
                physical_cores: physical,
                logical_cores: logical,
                cores,
            },
            memory,
            gpus,
            disks,
            network,
            battery: read_battery(),
            temperatures,
            system: SystemInfo {
                hostname: System::host_name().unwrap_or_else(|_| "—".into()),
                os: System::long_os_version()
                    .or_else(|_| System::os_version())
                    .unwrap_or_else(|_| "—".into()),
                kernel: System::kernel_version().unwrap_or_else(|_| "—".into()),
                arch: System::cpu_arch(),
                cpu_brand: brand,
                uptime_secs: System::uptime().unwrap_or(0),
            },
            processes,
        }
    }
}

fn lossy_label(name: &std::ffi::OsStr, mount: &str) -> String {
    let text = name.to_string_lossy().trim().to_string();
    if text.is_empty() {
        mount.to_string()
    } else {
        text
    }
}

fn unix_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn read_battery() -> Option<BatteryInfo> {
    use starship_battery::units::power::watt;
    use starship_battery::units::ratio::percent;
    use starship_battery::units::time::second;
    use starship_battery::{Manager, State};

    let manager = Manager::new().ok()?;
    let mut batteries = manager.batteries().ok()?;
    let battery = batteries.next()?.ok()?;
    let pct = battery.state_of_charge().get::<percent>();
    if !pct.is_finite() {
        return None;
    }
    let state = match battery.state() {
        State::Charging => "charging",
        State::Discharging => "discharging",
        State::Full => "full",
        State::Empty => "empty",
        _ => "unknown",
    };
    let secs_remaining = match battery.state() {
        State::Charging => battery.time_to_full(),
        State::Discharging => battery.time_to_empty(),
        _ => None,
    }
    .map(|t| t.get::<second>() as u64);
    let power = battery.energy_rate().get::<watt>();
    Some(BatteryInfo {
        percent: clamp_percent(pct),
        state: state.into(),
        secs_remaining,
        power_watts: if power.is_finite() { Some(power) } else { None },
    })
}

pub fn kill_pid(pid: u32) -> Result<(), String> {
    if pid == std::process::id() {
        return Err("Refusing to end DeskStats itself.".into());
    }
    let mut sys = System::new().map_err(|err| err.to_string())?;
    let target = Pid::from_u32(pid);
    sys.refresh_processes(ProcessesToUpdate::Some(&[target]), false);
    let process = sys
        .process(target)
        .ok_or_else(|| "Process not found.".to_string())?;
    if process.kill() {
        Ok(())
    } else {
        Err("Unable to end this process. It may require higher permissions.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collector_samples_without_panic() {
        let mut collector = Collector::new();
        let snap = collector.sample();
        assert!(!snap.demo);
        assert!(snap.cpu.usage.is_finite());
        assert!(snap.memory.used <= snap.memory.total.saturating_add(snap.memory.total));
        assert!(snap.processes.len() <= 250);
        for process in &snap.processes {
            assert!(process.cpu.is_finite());
            assert!(process.cpu <= 100.0);
        }
    }
}
