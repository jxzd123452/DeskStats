use crate::model::GpuInfo;

#[cfg(feature = "nvidia")]
use crate::metrics::clamp_percent;

pub fn read_nvidia() -> Vec<GpuInfo> {
    #[cfg(feature = "nvidia")]
    {
        match read_inner() {
            Ok(gpus) => gpus,
            Err(err) => {
                log_once(&err);
                Vec::new()
            }
        }
    }
    #[cfg(not(feature = "nvidia"))]
    {
        Vec::new()
    }
}

#[cfg(feature = "nvidia")]
fn log_once(err: &dyn std::fmt::Display) {
    use std::sync::atomic::{AtomicBool, Ordering};
    static LOGGED: AtomicBool = AtomicBool::new(false);
    if !LOGGED.swap(true, Ordering::Relaxed) {
        eprintln!("deskstats: NVML unavailable ({err})");
    }
}

#[cfg(feature = "nvidia")]
fn read_inner() -> Result<Vec<GpuInfo>, Box<dyn std::error::Error>> {
    use std::sync::OnceLock;

    use nvml_wrapper::enum_wrappers::device::TemperatureSensor;
    use nvml_wrapper::Nvml;

    static NVML: OnceLock<Result<Nvml, String>> = OnceLock::new();
    let nvml = match NVML.get_or_init(|| Nvml::init().map_err(|err| err.to_string())) {
        Ok(nvml) => nvml,
        Err(err) => return Err(err.clone().into()),
    };

    let count = nvml.device_count()?;
    let mut out = Vec::with_capacity(count as usize);
    for index in 0..count {
        let device = match nvml.device_by_index(index) {
            Ok(device) => device,
            Err(err) => {
                eprintln!("deskstats: skip NVIDIA GPU {index}: {err}");
                continue;
            }
        };
        let name = device
            .name()
            .unwrap_or_else(|_| format!("NVIDIA GPU {index}"));
        let usage = device
            .utilization_rates()
            .ok()
            .map(|util| clamp_percent(util.gpu as f32));
        let (memory_total, memory_used) = match device.memory_info() {
            Ok(mem) => (Some(mem.total), Some(mem.used)),
            Err(_) => (None, None),
        };
        let temperature_c = device
            .temperature(TemperatureSensor::Gpu)
            .ok()
            .map(|c| c as f32);
        let power_watts = device.power_usage().ok().map(|mw| mw as f32 / 1000.0);
        out.push(GpuInfo {
            name,
            vendor: "NVIDIA".into(),
            usage,
            memory_total,
            memory_used,
            temperature_c,
            power_watts,
        });
    }
    Ok(out)
}
