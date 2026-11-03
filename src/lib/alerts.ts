import type { Snapshot } from "../types";
import { percentOf } from "./format";

export type AlertMetric = "cpu" | "memory" | "gpu" | "temperature" | "diskFree" | "battery";
export type AlertDirection = "above" | "below";
export type AlertPhase = "clear" | "pending" | "firing";

export interface AlertRule {
  id: string;
  metric: AlertMetric;
  enabled: boolean;
  /** Percent, or degrees Celsius for temperature. */
  threshold: number;
  /** How long the breach must hold before a notification. */
  durationMs: number;
  /** Minimum gap between notifications for this rule. */
  cooldownMs: number;
  /** How far the reading must recover before the incident clears. */
  hysteresis: number;
}

export interface RuleRuntime {
  phase: AlertPhase;
  since: number | null;
  lastFiredAt: number | null;
}

export interface EngineState {
  lastStepAt: number | null;
  rules: Record<string, RuleRuntime>;
}

export interface Readings {
  cpu: number | null;
  memory: number | null;
  gpu: number | null;
  temperature: number | null;
  diskFree: number | null;
  battery: number | null;
}

export interface FiredAlert {
  ruleId: string;
  metric: AlertMetric;
  value: number;
  threshold: number;
  at: number;
}

export interface AlertHistoryItem {
  id: string;
  ruleId: string;
  metric: AlertMetric;
  value: number;
  threshold: number;
  at: number;
}

export interface AlertStore {
  rules: AlertRule[];
  history: AlertHistoryItem[];
  runtime: EngineState;
}

export const ALERT_STORAGE_KEY = "deskstats.alerts.v1";
export const HISTORY_LIMIT = 40;
export const HOLD_PRESETS = [10_000, 30_000, 60_000, 120_000, 300_000];
export const COOLDOWN_PRESETS = [60_000, 300_000, 900_000, 1_800_000];

const METRICS: AlertMetric[] = ["cpu", "memory", "gpu", "temperature", "diskFree", "battery"];

const DEFAULT_RULES: AlertRule[] = [
  { id: "cpu", metric: "cpu", enabled: true, threshold: 90, durationMs: 30_000, cooldownMs: 5 * 60_000, hysteresis: 5 },
  { id: "memory", metric: "memory", enabled: true, threshold: 90, durationMs: 30_000, cooldownMs: 5 * 60_000, hysteresis: 5 },
  { id: "gpu", metric: "gpu", enabled: true, threshold: 95, durationMs: 60_000, cooldownMs: 10 * 60_000, hysteresis: 5 },
  { id: "temperature", metric: "temperature", enabled: true, threshold: 90, durationMs: 30_000, cooldownMs: 5 * 60_000, hysteresis: 3 },
  { id: "diskFree", metric: "diskFree", enabled: true, threshold: 10, durationMs: 60_000, cooldownMs: 30 * 60_000, hysteresis: 2 },
  { id: "battery", metric: "battery", enabled: true, threshold: 20, durationMs: 30_000, cooldownMs: 15 * 60_000, hysteresis: 5 },
];

export function defaultRules(): AlertRule[] {
  return DEFAULT_RULES.map((rule) => ({ ...rule }));
}

export function emptyEngine(): EngineState {
  return { lastStepAt: null, rules: {} };
}

export function directionFor(metric: AlertMetric): AlertDirection {
  return metric === "diskFree" || metric === "battery" ? "below" : "above";
}

export function unitFor(metric: AlertMetric): string {
  return metric === "temperature" ? "°C" : "%";
}

export function isAlertMetric(value: unknown): value is AlertMetric {
  return typeof value === "string" && (METRICS as string[]).includes(value);
}

export function formatSpan(ms: number, lang: "en" | "zh"): string {
  const safe = Math.max(0, Math.round(ms / 1000));
  if (safe >= 60 && safe % 60 === 0) {
    const minutes = safe / 60;
    return lang === "zh" ? `${minutes} 分钟` : `${minutes} min`;
  }
  return lang === "zh" ? `${safe} 秒` : `${safe}s`;
}

function bounds(metric: AlertMetric): { min: number; max: number } {
  if (metric === "temperature") return { min: 30, max: 120 };
  if (metric === "diskFree" || metric === "battery") return { min: 1, max: 80 };
  return { min: 1, max: 100 };
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function sanitizeRule(rule: AlertRule): AlertRule {
  const base = DEFAULT_RULES.find((item) => item.id === rule.id) ?? DEFAULT_RULES[0];
  const metric = isAlertMetric(rule.metric) ? rule.metric : base.metric;
  const limit = bounds(metric);
  return {
    id: base.id,
    metric,
    enabled: rule.enabled !== false,
    threshold: clamp(rule.threshold, limit.min, limit.max, base.threshold),
    durationMs: clamp(rule.durationMs, 1_000, 30 * 60_000, base.durationMs),
    cooldownMs: clamp(rule.cooldownMs, 1_000, 6 * 60 * 60_000, base.cooldownMs),
    hysteresis: clamp(rule.hysteresis, 0, 40, base.hysteresis),
  };
}

export function defaultAlertStore(): AlertStore {
  return { rules: defaultRules(), history: [], runtime: emptyEngine() };
}

function sanitizeRuntime(raw: unknown): EngineState {
  if (!raw || typeof raw !== "object") return emptyEngine();
  const record = raw as Partial<EngineState>;
  const rules: Record<string, RuleRuntime> = {};
  const source = record.rules && typeof record.rules === "object" ? record.rules : {};
  for (const [id, value] of Object.entries(source)) {
    if (!value || typeof value !== "object") continue;
    const runtime = value as Partial<RuleRuntime>;
    const phase: AlertPhase =
      runtime.phase === "pending" || runtime.phase === "firing" || runtime.phase === "clear"
        ? runtime.phase
        : "clear";
    rules[id] = {
      phase,
      since: typeof runtime.since === "number" && Number.isFinite(runtime.since) ? runtime.since : null,
      lastFiredAt:
        typeof runtime.lastFiredAt === "number" && Number.isFinite(runtime.lastFiredAt) ? runtime.lastFiredAt : null,
    };
  }
  const last = record.lastStepAt;
  return {
    lastStepAt: typeof last === "number" && Number.isFinite(last) ? last : null,
    rules,
  };
}

function sanitizeHistory(raw: unknown): AlertHistoryItem[] {
  if (!Array.isArray(raw)) return [];
  const items: AlertHistoryItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Partial<AlertHistoryItem>;
    if (!isAlertMetric(item.metric) || typeof item.at !== "number" || !Number.isFinite(item.at)) continue;
    if (typeof item.value !== "number" || typeof item.threshold !== "number") continue;
    const ruleId = typeof item.ruleId === "string" ? item.ruleId : item.metric;
    items.push({
      id: typeof item.id === "string" ? item.id : `${ruleId}:${item.at}`,
      ruleId,
      metric: item.metric,
      value: item.value,
      threshold: item.threshold,
      at: item.at,
    });
  }
  return items.slice(0, HISTORY_LIMIT);
}

export function loadAlertStore(raw: string | null | undefined): AlertStore {
  const base = defaultAlertStore();
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<AlertStore> & { rules?: Partial<AlertRule>[] };
    const incoming = new Map<string, Partial<AlertRule>>();
    if (Array.isArray(parsed.rules)) {
      for (const rule of parsed.rules) {
        if (rule && typeof rule.id === "string") incoming.set(rule.id, rule);
      }
    }
    return {
      rules: base.rules.map((rule) => sanitizeRule({ ...rule, ...incoming.get(rule.id), id: rule.id, metric: rule.metric })),
      history: sanitizeHistory(parsed.history),
      runtime: sanitizeRuntime(parsed.runtime),
    };
  } catch {
    return base;
  }
}

export function readingsFromSnapshot(snap: Snapshot): Readings {
  const memory = snap.memory.total > 0 ? percentOf(snap.memory.used, snap.memory.total) : null;
  const gpu = snap.gpus.find((item) => item.usage != null && Number.isFinite(item.usage));
  const temps = snap.temperatures.filter((item) => Number.isFinite(item.celsius));
  const disks = snap.disks.filter((item) => item.total > 0);
  return {
    cpu: Number.isFinite(snap.cpu.usage) ? snap.cpu.usage : null,
    memory,
    gpu: gpu?.usage ?? null,
    temperature: temps.length ? Math.max(...temps.map((item) => item.celsius)) : null,
    diskFree: disks.length
      ? Math.min(...disks.map((item) => Math.max(0, (1 - item.used / item.total) * 100)))
      : null,
    battery: snap.battery && Number.isFinite(snap.battery.percent) ? snap.battery.percent : null,
  };
}

function readingOf(readings: Readings, metric: AlertMetric): number | null {
  const value = readings[metric];
  return value == null || !Number.isFinite(value) ? null : value;
}

function isHot(rule: AlertRule, value: number, sticky: boolean): boolean {
  const band = sticky ? Math.max(0, rule.hysteresis) : 0;
  if (directionFor(rule.metric) === "above") return value >= rule.threshold - band;
  return value <= rule.threshold + band;
}

const CLEAR_RUNTIME: RuleRuntime = { phase: "clear", since: null, lastFiredAt: null };

/**
 * One pass of the alert engine.
 *
 * A rule arms only after the reading stays past the threshold for `durationMs`.
 * It will not notify again until `cooldownMs` has elapsed. While the incident
 * is open, the reading must recover by `hysteresis` before the hold timer resets,
 * so noise around the line does not spam or cancel a pending alert.
 * A gap larger than `gapResetMs` (sleep, pause) drops pending state.
 * Missing readings pause a pending hold instead of counting as time-in-breach.
 */
export function stepAlerts(
  rules: readonly AlertRule[],
  readings: Readings,
  state: EngineState,
  now: number,
  gapResetMs = 45_000,
): { state: EngineState; fired: FiredAlert[] } {
  let working = state;
  if (state.lastStepAt != null && now > state.lastStepAt && now - state.lastStepAt > gapResetMs) {
    const reset: Record<string, RuleRuntime> = {};
    for (const [id, runtime] of Object.entries(state.rules)) {
      reset[id] = { phase: "clear", since: null, lastFiredAt: runtime.lastFiredAt };
    }
    working = { lastStepAt: state.lastStepAt, rules: reset };
  }

  const fired: FiredAlert[] = [];
  const nextRules: Record<string, RuleRuntime> = {};
  for (const rule of rules) {
    const prev = working.rules[rule.id] ?? { ...CLEAR_RUNTIME };
    if (!rule.enabled) {
      nextRules[rule.id] = { phase: "clear", since: null, lastFiredAt: prev.lastFiredAt };
      continue;
    }
    const value = readingOf(readings, rule.metric);
    if (value == null) {
      if (prev.phase === "pending" && prev.since != null && working.lastStepAt != null) {
        const gap = Math.max(0, now - working.lastStepAt);
        nextRules[rule.id] = { ...prev, since: prev.since + gap };
      } else {
        nextRules[rule.id] = prev;
      }
      continue;
    }
    const sticky = prev.phase !== "clear";
    if (!isHot(rule, value, sticky)) {
      nextRules[rule.id] = { phase: "clear", since: null, lastFiredAt: prev.lastFiredAt };
      continue;
    }
    const since = prev.phase === "clear" ? now : (prev.since ?? now);
    const phase: AlertPhase = prev.phase === "clear" ? "pending" : prev.phase;
    const held = now - since >= rule.durationMs;
    const cooled = prev.lastFiredAt == null || now - prev.lastFiredAt >= rule.cooldownMs;
    if (held && cooled) {
      fired.push({ ruleId: rule.id, metric: rule.metric, value, threshold: rule.threshold, at: now });
      nextRules[rule.id] = { phase: "firing", since, lastFiredAt: now };
      continue;
    }
    nextRules[rule.id] = { phase, since, lastFiredAt: prev.lastFiredAt };
  }

  return { state: { lastStepAt: now, rules: nextRules }, fired };
}

export function clearPending(state: EngineState): EngineState {
  const rules: Record<string, RuleRuntime> = {};
  for (const [id, runtime] of Object.entries(state.rules)) {
    rules[id] =
      runtime.phase === "pending"
        ? { phase: "clear", since: null, lastFiredAt: runtime.lastFiredAt }
        : runtime;
  }
  return { ...state, rules };
}

export function resetRuleRuntime(state: EngineState, id: string): EngineState {
  const prev = state.rules[id];
  return {
    ...state,
    rules: {
      ...state.rules,
      [id]: { phase: "clear", since: null, lastFiredAt: prev?.lastFiredAt ?? null },
    },
  };
}

export function historyFromFire(event: FiredAlert): AlertHistoryItem {
  return {
    id: `${event.ruleId}:${event.at}`,
    ruleId: event.ruleId,
    metric: event.metric,
    value: event.value,
    threshold: event.threshold,
    at: event.at,
  };
}

/** Fixed rows for the alerts settings screenshot. */
export function screenshotHistory(): AlertHistoryItem[] {
  const base = Date.UTC(2026, 10, 3, 9, 41, 0);
  return [
    { id: "cpu:shot", ruleId: "cpu", metric: "cpu", value: 94, threshold: 90, at: base - 2 * 60_000 },
    { id: "temperature:shot", ruleId: "temperature", metric: "temperature", value: 91, threshold: 90, at: base - 26 * 60_000 },
    { id: "diskFree:shot", ruleId: "diskFree", metric: "diskFree", value: 8, threshold: 10, at: base - 3 * 60 * 60_000 },
  ];
}
