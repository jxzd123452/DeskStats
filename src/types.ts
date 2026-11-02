export interface CoreInfo {
  id: number;
  usage: number;
  frequencyMhz: number;
}

export interface CpuInfo {
  usage: number;
  frequencyMhz: number;
  brand: string;
  physicalCores: number;
  logicalCores: number;
  cores: CoreInfo[];
}

export interface MemoryInfo {
  total: number;
  used: number;
  available: number;
  swapTotal: number;
  swapUsed: number;
}

export interface GpuInfo {
  name: string;
  vendor: string;
  usage: number | null;
  memoryTotal: number | null;
  memoryUsed: number | null;
  temperatureC: number | null;
  powerWatts: number | null;
}

export interface DiskInfo {
  name: string;
  mount: string;
  kind: string;
  total: number;
  used: number;
  readBps: number;
  writeBps: number;
}

export interface NicInfo {
  name: string;
  downBps: number;
  upBps: number;
  totalDown: number;
  totalUp: number;
}

export interface NetworkInfo {
  interfaceName: string;
  downBps: number;
  upBps: number;
  totalDown: number;
  totalUp: number;
  interfaces: NicInfo[];
}

export interface BatteryInfo {
  percent: number;
  state: string;
  secsRemaining: number | null;
  powerWatts: number | null;
}

export interface TempInfo {
  label: string;
  celsius: number;
  critical: number | null;
}

export interface SystemInfo {
  hostname: string;
  os: string;
  kernel: string;
  arch: string;
  cpuBrand: string;
  uptimeSecs: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  user: string;
}

export interface Snapshot {
  timestampMs: number;
  demo: boolean;
  paused: boolean;
  cpu: CpuInfo;
  memory: MemoryInfo;
  gpus: GpuInfo[];
  disks: DiskInfo[];
  network: NetworkInfo;
  battery: BatteryInfo | null;
  temperatures: TempInfo[];
  system: SystemInfo;
  processes: ProcessInfo[];
}

export type Page =
  | "overview"
  | "cpu"
  | "memory"
  | "gpu"
  | "disk"
  | "network"
  | "processes"
  | "settings";

export type ThemeSetting = "system" | "dark" | "light";
export type LangSetting = "system" | "en" | "zh";
export type IntervalMs = 500 | 1000 | 2000 | 5000;

export interface Settings {
  theme: ThemeSetting;
  lang: LangSetting;
  reduceMotion: boolean;
  intervalMs: IntervalMs;
  slowWhenHidden: boolean;
  closeToTray: boolean;
}

export interface Sample {
  t: number;
  cpu: number;
  mem: number;
  gpu: number;
  down: number;
  up: number;
  read: number;
  write: number;
  cores: number[];
}

export interface HostMeta {
  demo: boolean;
  material: string;
  os: string;
}
