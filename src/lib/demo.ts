import type { ProcessInfo, Snapshot } from "../types";

const GIB = 1024 ** 3;
export const SHOT_TICK = 72;

interface ProcSeed {
  pid: number;
  name: string;
  user: string;
  cpu: number;
  memory: number;
}

const PROCS: ProcSeed[] = [
  { pid: 18420, name: "Cursor", user: "aurora", cpu: 9.4, memory: 1_760_000_000 },
  { pid: 4412, name: "chrome", user: "aurora", cpu: 6.6, memory: 2_480_000_000 },
  { pid: 2204, name: "Code", user: "aurora", cpu: 4.1, memory: 934_000_000 },
  { pid: 9088, name: "WindowsTerminal", user: "aurora", cpu: 3.4, memory: 196_000_000 },
  { pid: 3310, name: "Discord", user: "aurora", cpu: 2.3, memory: 540_000_000 },
  { pid: 7741, name: "MsMpEng", user: "SYSTEM", cpu: 2.0, memory: 286_000_000 },
  { pid: 5120, name: "slack", user: "aurora", cpu: 1.5, memory: 668_000_000 },
  { pid: 6402, name: "Spotify", user: "aurora", cpu: 1.1, memory: 334_000_000 },
  { pid: 1180, name: "steamwebhelper", user: "aurora", cpu: 0.9, memory: 248_000_000 },
  { pid: 860, name: "dwm", user: "aurora", cpu: 0.8, memory: 102_000_000 },
  { pid: 2104, name: "svchost", user: "SYSTEM", cpu: 0.7, memory: 92_000_000 },
  { pid: 4012, name: "explorer", user: "aurora", cpu: 0.6, memory: 148_000_000 },
  { pid: 1555, name: "OneDrive", user: "aurora", cpu: 0.4, memory: 172_000_000 },
  { pid: 990, name: "SearchHost", user: "aurora", cpu: 0.3, memory: 124_000_000 },
  { pid: 720, name: "audiodg", user: "LOCAL SERVICE", cpu: 0.2, memory: 28_000_000 },
  { pid: 4, name: "System", user: "SYSTEM", cpu: 0.3, memory: 12_000_000 },
];

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function cpuWave(t: number): number {
  const a = Math.sin(t * 0.085) * 8;
  const b = Math.sin(t * 0.023 + 1.2) * 6;
  const c = Math.sin(t * 0.21 + 0.4) * 3.2;
  const phase = (t % 55) - 28;
  const hill = Math.exp(-(phase * phase) / 90) * 12;
  return clamp(34 + a + b + c + hill, 6, 92);
}

export function gpuWave(t: number): number {
  const bump = t % 40 > 30 ? 10 : 0;
  return clamp(30 + Math.sin(t * 0.06) * 9 + Math.sin(t * 0.19) * 5 + bump, 4, 96);
}

function downBps(t: number): number {
  const base = 5_400_000 + Math.sin(t * 0.09) * 2_200_000 + Math.sin(t * 0.031 + 0.7) * 1_600_000;
  const burst = Math.exp(-(((t % 32) - 14) ** 2) / 28) * 4_800_000;
  return Math.round(Math.max(900_000, base + burst));
}

function upBps(t: number): number {
  const base = 780_000 + Math.sin(t * 0.13 + 1.1) * 280_000 + Math.sin(t * 0.041) * 220_000;
  const burst = Math.exp(-(((t % 32) - 20) ** 2) / 22) * 1_400_000;
  return Math.round(Math.max(180_000, base + burst));
}

export function demoSnapshot(tick: number, killed: ReadonlySet<number> = new Set()): Snapshot {
  const cpu = cpuWave(tick);
  const logical = 8;
  const biases = [0.62, 0.9, 1.42, 1.18, 0.74, 1.05, 0.48, 1.28];
  const raw = biases.map((bias, id) => {
    const wobble = 1 + 0.07 * Math.sin(tick * 0.21 + id);
    return clamp(cpu * bias * wobble, 0.4, 99);
  });
  const avg = raw.reduce((sum, value) => sum + value, 0) / logical;
  const scale = avg > 0.1 ? cpu / avg : 1;
  const cores = raw.map((usage, id) => ({
    id,
    usage: clamp(usage * scale),
    frequencyMhz: Math.round(4200 + Math.sin(tick * 0.3 + id) * 280),
  }));

  const memTotal = 32 * GIB;
  const memPct = Math.min(0.9, Math.max(0.4, 0.586 + Math.sin(tick * 0.012) * 0.012));
  const memUsed = Math.round(memTotal * memPct);
  const swapTotal = 8 * GIB;
  const swapUsed = Math.round(swapTotal * 0.06);
  const gpu = gpuWave(tick);
  const vramTotal = 12 * GIB;
  const vramUsed = Math.round(vramTotal * (0.34 + Math.sin(tick * 0.02) * 0.03));
  const down = downBps(tick);
  const up = upBps(tick);
  const diskRead = Math.round(1_200_000 + Math.abs(Math.sin(tick * 0.11)) * 18_000_000);
  const diskWrite = Math.round(400_000 + Math.abs(Math.sin(tick * 0.07 + 1)) * 4_000_000);

  const processes: ProcessInfo[] = PROCS.filter((proc) => !killed.has(proc.pid))
    .map((proc) => ({
      pid: proc.pid,
      name: proc.name,
      user: proc.user,
      cpu: clamp(proc.cpu * (1 + 0.04 * Math.sin(tick * 0.17 + proc.pid))),
      memory: proc.memory,
    }))
    .sort((a, b) => b.cpu - a.cpu || a.pid - b.pid);

  return {
    timestampMs: 1_762_000_000_000 + tick * 1000,
    demo: true,
    paused: false,
    cpu: {
      usage: cpu,
      frequencyMhz: Math.max(...cores.map((core) => core.frequencyMhz)),
      brand: "AMD Ryzen 7 7800X3D",
      physicalCores: 8,
      logicalCores: logical,
      cores,
    },
    memory: {
      total: memTotal,
      used: memUsed,
      available: memTotal - memUsed,
      swapTotal,
      swapUsed,
    },
    gpus: [
      {
        name: "NVIDIA GeForce RTX 4070",
        vendor: "NVIDIA",
        usage: gpu,
        memoryTotal: vramTotal,
        memoryUsed: vramUsed,
        temperatureC: 58 + gpu * 0.18,
        powerWatts: 42 + gpu * 1.35,
      },
    ],
    disks: [
      {
        name: "Samsung 990 PRO",
        mount: "C:\\",
        kind: "SSD",
        total: GIB * 1000,
        used: Math.round(GIB * 612),
        readBps: diskRead,
        writeBps: Math.round(diskWrite / 3),
      },
      {
        name: "WD Black SN850X",
        mount: "D:\\",
        kind: "SSD",
        total: GIB * 2000,
        used: Math.round(GIB * 804),
        readBps: Math.round(diskRead / 8 + 180_000),
        writeBps: Math.round(diskWrite / 2),
      },
    ],
    network: {
      interfaceName: "Wi-Fi",
      downBps: down,
      upBps: up,
      totalDown: 86 * GIB + tick * 400_000,
      totalUp: 12 * GIB + tick * 40_000,
      interfaces: [
        { name: "Wi-Fi", downBps: down, upBps: up, totalDown: 86 * GIB, totalUp: 12 * GIB },
        { name: "Ethernet", downBps: 0, upBps: 0, totalDown: 2 * GIB, totalUp: GIB / 2 },
      ],
    },
    battery: {
      percent: 76,
      state: "charging",
      secsRemaining: 72 * 60,
      powerWatts: 38.4,
    },
    temperatures: [
      { label: "CPU Package", celsius: 54 + cpu * 0.22, critical: 95 },
      { label: "GPU", celsius: 58 + gpu * 0.18, critical: 93 },
      { label: "NVMe", celsius: 41 + Math.sin(tick * 0.05), critical: 85 },
    ],
    system: {
      hostname: "AURORA",
      os: "Windows 11 Pro",
      kernel: "10.0.26100",
      arch: "x86_64",
      cpuBrand: "AMD Ryzen 7 7800X3D",
      uptimeSecs: 2 * 86400 + 14 * 3600 + 22 * 60,
    },
    processes,
  };
}

export const DEMO_PROCESS_COUNT = PROCS.length;
