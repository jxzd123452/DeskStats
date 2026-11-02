export const ACCENTS = {
  dark: {
    cpu: "#4F8CFF",
    memory: "#A78BFA",
    gpu: "#34D399",
    disk: "#FBBF24",
    down: "#22D3EE",
    up: "#F472B6",
    temp: "#FB7185",
    battery: "#A3E635",
    warn: "#F59E0B",
    danger: "#EF4444",
  },
  light: {
    cpu: "#2563EB",
    memory: "#7C3AED",
    gpu: "#059669",
    disk: "#D97706",
    down: "#0891B2",
    up: "#DB2777",
    temp: "#E11D48",
    battery: "#65A30D",
    warn: "#D97706",
    danger: "#DC2626",
  },
} as const;

export type AccentSet = { [K in keyof (typeof ACCENTS)["dark"]]: string };
export type ResolvedTheme = keyof typeof ACCENTS;

export function metricColor(accent: string, percent: number, palette: AccentSet): string {
  if (!Number.isFinite(percent)) return accent;
  if (percent >= 90) return palette.danger;
  if (percent >= 75) return palette.warn;
  return accent;
}

export function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
