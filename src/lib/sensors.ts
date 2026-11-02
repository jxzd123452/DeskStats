import type { TempInfo } from "../types";

export function pickCpuTemp(temps: TempInfo[]): number | null {
  const hit = temps.find((temp) => /package|tctl|tdie|\bcpu\b/i.test(temp.label));
  return hit ? hit.celsius : null;
}

export function pickGpuTemp(temps: TempInfo[], direct: number | null | undefined): number | null {
  if (direct != null && Number.isFinite(direct)) return direct;
  const hit = temps.find((temp) => /gpu|nvidia|radeon/i.test(temp.label));
  return hit ? hit.celsius : null;
}

export function usageLevel(percent: number): "ok" | "warn" | "crit" {
  if (percent >= 90) return "crit";
  if (percent >= 75) return "warn";
  return "ok";
}

export function tempLevel(celsius: number): "ok" | "warn" | "crit" {
  if (celsius >= 95) return "crit";
  if (celsius >= 85) return "warn";
  return "ok";
}
