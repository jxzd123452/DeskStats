import type { Sample, Snapshot } from "../types";

export function sampleFrom(snap: Snapshot): Sample {
  const read = snap.disks.reduce((sum, disk) => sum + disk.readBps, 0);
  const write = snap.disks.reduce((sum, disk) => sum + disk.writeBps, 0);
  return {
    t: snap.timestampMs,
    cpu: snap.cpu.usage,
    mem: percentOfSafe(snap.memory.used, snap.memory.total),
    gpu: snap.gpus[0]?.usage ?? 0,
    down: snap.network.downBps,
    up: snap.network.upBps,
    read,
    write,
    cores: snap.cpu.cores.map((core) => core.usage),
  };
}

function percentOfSafe(used: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.max(0, (used / total) * 100));
}

export function appendSample(history: Sample[], snap: Snapshot, keepMs = 5 * 60 * 1000): Sample[] {
  const sample = sampleFrom(snap);
  const withoutDup =
    history.length > 0 && history[history.length - 1].t === sample.t
      ? history.slice(0, -1)
      : history;
  const next = [...withoutDup, sample];
  const cut = sample.t - keepMs;
  return next.filter((point) => point.t >= cut).slice(-360);
}

export interface Series {
  x: number[];
  y: number[];
}

export function windowSeries(
  history: Sample[],
  windowMs: number,
  pick: (sample: Sample) => number,
): Series {
  if (history.length === 0) return { x: [], y: [] };
  const end = history[history.length - 1].t;
  const slice = history.filter((point) => point.t >= end - windowMs);
  const origin = slice[0]?.t ?? end;
  return {
    x: slice.map((point) => (point.t - origin) / 1000),
    y: slice.map(pick),
  };
}

export function coreSeries(history: Sample[], windowMs: number, index: number): Series {
  return windowSeries(history, windowMs, (sample) => sample.cores[index] ?? 0);
}
