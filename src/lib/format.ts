export interface Quantity {
  value: string;
  unit: string;
}

const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export function formatBytes(bytes: number): Quantity {
  const safe = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  let value = safe;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return { value: unit === 0 ? String(Math.round(value)) : trimNumber(value), unit: UNITS[unit] };
}

export function formatRate(bytesPerSec: number): Quantity {
  const q = formatBytes(bytesPerSec);
  return { value: q.value, unit: `${q.unit}/s` };
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

export function formatGhz(mhz: number): string | null {
  if (!Number.isFinite(mhz) || mhz <= 0) return null;
  return (mhz / 1000).toFixed(2);
}

function trimNumber(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

export function formatUptime(secs: number, lang: "en" | "zh"): string {
  const safe = Math.max(0, Math.floor(secs));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  if (lang === "zh") {
    if (days > 0) return `${days} 天 ${hours} 小时`;
    if (hours > 0) return `${hours} 小时 ${mins} 分`;
    return `${mins} 分`;
  }
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function formatDuration(secs: number | null, lang: "en" | "zh"): string | null {
  if (secs == null || !Number.isFinite(secs)) return null;
  const safe = Math.max(0, Math.floor(secs));
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  if (lang === "zh") {
    if (hours > 0) return `${hours} 小时 ${mins} 分`;
    return `${mins} 分`;
  }
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function percentOf(used: number, total: number): number {
  if (!total || !Number.isFinite(used) || !Number.isFinite(total)) return 0;
  return Math.min(100, Math.max(0, (used / total) * 100));
}

export const INTERVALS = [500, 1000, 2000, 5000] as const;

export function sanitizeInterval(value: number): (typeof INTERVALS)[number] {
  return INTERVALS.includes(value as (typeof INTERVALS)[number])
    ? (value as (typeof INTERVALS)[number])
    : 1000;
}
