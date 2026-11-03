export const WIDGET_KINDS = ["cpu", "memory", "gpu", "network", "disks", "sensors"] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];
export type WidgetMode = "top" | "desktop";

export interface WidgetPlacement {
  kind: WidgetKind;
  open: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  mode: WidgetMode;
  /** Background strength, 0.35–1. Text stays readable. */
  opacity: number;
  clickThrough: boolean;
}

export interface WidgetState {
  widgets: WidgetPlacement[];
}

export type WidgetPatch = Partial<Omit<WidgetPlacement, "kind">>;

export type AppRole =
  | { type: "main" }
  | { type: "widget"; kind: WidgetKind }
  | { type: "scene" };

export const WIDGET_STORAGE_KEY = "deskstats.widgets.v1";

const DEFAULTS: Record<WidgetKind, { width: number; height: number; x: number; y: number }> = {
  cpu: { width: 250, height: 168, x: 48, y: 64 },
  memory: { width: 230, height: 156, x: 320, y: 64 },
  gpu: { width: 240, height: 168, x: 572, y: 64 },
  network: { width: 280, height: 160, x: 48, y: 260 },
  disks: { width: 250, height: 176, x: 348, y: 260 },
  sensors: { width: 240, height: 168, x: 620, y: 260 },
};

export function isWidgetKind(value: unknown): value is WidgetKind {
  return typeof value === "string" && (WIDGET_KINDS as readonly string[]).includes(value);
}

export function defaultPlacement(kind: WidgetKind): WidgetPlacement {
  const preset = DEFAULTS[kind];
  return {
    kind,
    open: false,
    x: preset.x,
    y: preset.y,
    width: preset.width,
    height: preset.height,
    mode: "top",
    opacity: 0.86,
    clickThrough: false,
  };
}

export function defaultWidgetState(): WidgetState {
  return { widgets: WIDGET_KINDS.map((kind) => defaultPlacement(kind)) };
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function sanitizePlacement(kind: WidgetKind, raw: Partial<WidgetPlacement> | null | undefined): WidgetPlacement {
  const base = defaultPlacement(kind);
  if (!raw) return base;
  const opacity = clamp(raw.opacity ?? base.opacity, 0.35, 1, base.opacity);
  return {
    kind,
    open: raw.open === true,
    x: Math.round(clamp(raw.x ?? base.x, -500, 12_000, base.x)),
    y: Math.round(clamp(raw.y ?? base.y, -500, 12_000, base.y)),
    width: Math.round(clamp(raw.width ?? base.width, 180, 720, base.width)),
    height: Math.round(clamp(raw.height ?? base.height, 120, 520, base.height)),
    mode: raw.mode === "desktop" ? "desktop" : "top",
    opacity: Math.round(opacity * 100) / 100,
    clickThrough: raw.clickThrough === true,
  };
}

export function loadWidgetState(raw: string | null | undefined): WidgetState {
  if (!raw) return defaultWidgetState();
  try {
    const parsed = JSON.parse(raw) as { widgets?: Partial<WidgetPlacement>[] };
    const byKind = new Map<WidgetKind, Partial<WidgetPlacement>>();
    if (Array.isArray(parsed.widgets)) {
      for (const item of parsed.widgets) {
        if (item && isWidgetKind(item.kind)) byKind.set(item.kind, item);
      }
    }
    return { widgets: WIDGET_KINDS.map((kind) => sanitizePlacement(kind, byKind.get(kind))) };
  } catch {
    return defaultWidgetState();
  }
}

export function serializeWidgetState(state: WidgetState): string {
  return JSON.stringify(loadWidgetState(JSON.stringify({ widgets: state.widgets })));
}

export function placementOf(state: WidgetState, kind: WidgetKind): WidgetPlacement {
  return state.widgets.find((item) => item.kind === kind) ?? defaultPlacement(kind);
}

function samePlacement(a: WidgetPlacement, b: WidgetPlacement): boolean {
  return (
    a.open === b.open &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.mode === b.mode &&
    a.opacity === b.opacity &&
    a.clickThrough === b.clickThrough
  );
}

export function updateWidget(state: WidgetState, kind: WidgetKind, patch: WidgetPatch): WidgetState {
  const current = placementOf(state, kind);
  const next = sanitizePlacement(kind, { ...current, ...patch, kind });
  if (samePlacement(current, next)) return state;
  return {
    widgets: WIDGET_KINDS.map((item) => (item === kind ? next : placementOf(state, item))),
  };
}

export function toggleWidget(state: WidgetState, kind: WidgetKind, open?: boolean): WidgetState {
  const current = placementOf(state, kind);
  const nextOpen = open ?? !current.open;
  if (current.open === nextOpen) return state;
  return updateWidget(state, kind, { open: nextOpen });
}

export function closeWidget(state: WidgetState, kind: WidgetKind): WidgetState {
  return toggleWidget(state, kind, false);
}

export function unlockWidgets(state: WidgetState): WidgetState {
  if (state.widgets.every((item) => !item.clickThrough)) return state;
  return { widgets: state.widgets.map((item) => ({ ...item, clickThrough: false })) };
}

export interface WidgetGeometry {
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function updateGeometry(state: WidgetState, geometry: WidgetGeometry): WidgetState {
  if (!isWidgetKind(geometry.kind)) return state;
  const current = placementOf(state, geometry.kind);
  if (!current.open) return state;
  return updateWidget(state, geometry.kind, {
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height,
  });
}

export function detectRole(search: string): AppRole {
  const query = new URLSearchParams(search);
  if (query.get("page") === "widgets" || query.get("scene") === "desktop") return { type: "scene" };
  const fromQuery = query.get("widget");
  if (isWidgetKind(fromQuery)) return { type: "widget", kind: fromQuery };
  const injected = (globalThis as { __DESKSTATS_WIDGET__?: unknown }).__DESKSTATS_WIDGET__;
  if (isWidgetKind(injected)) return { type: "widget", kind: injected };
  return { type: "main" };
}

export function metricKey(kind: WidgetKind): `metric.${WidgetKind}` {
  return `metric.${kind}`;
}
