import { detectLang } from "../i18n";
import type { IntervalMs, LangSetting, Page, Settings, ThemeSetting } from "../types";
import { INTERVALS, sanitizeInterval } from "./format";

const KEY = "deskstats.v1";

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  lang: "system",
  reduceMotion: false,
  intervalMs: 1000,
  slowWhenHidden: true,
  closeToTray: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, reduceMotion: prefersReducedMotion() };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      theme: isTheme(parsed.theme) ? parsed.theme : "system",
      lang: isLang(parsed.lang) ? parsed.lang : "system",
      reduceMotion: typeof parsed.reduceMotion === "boolean" ? parsed.reduceMotion : prefersReducedMotion(),
      intervalMs: sanitizeInterval(parsed.intervalMs ?? 1000),
      slowWhenHidden: parsed.slowWhenHidden !== false,
      closeToTray: parsed.closeToTray !== false,
    };
  } catch {
    return { ...DEFAULT_SETTINGS, reduceMotion: prefersReducedMotion() };
  }
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* private mode / disabled storage */
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function isTheme(value: unknown): value is ThemeSetting {
  return value === "system" || value === "dark" || value === "light";
}

function isLang(value: unknown): value is LangSetting {
  return value === "system" || value === "en" || value === "zh";
}

export function resolveTheme(setting: ThemeSetting): "dark" | "light" {
  if (setting === "dark" || setting === "light") return setting;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function resolveLang(setting: LangSetting): "en" | "zh" {
  if (setting === "en" || setting === "zh") return setting;
  return detectLang(navigator.language || "en");
}

export interface BootQuery {
  page: Page;
  theme?: ThemeSetting;
  lang?: LangSetting;
  shot: boolean;
  tick: number;
  intervalMs?: IntervalMs;
}

const PAGES: Page[] = ["overview", "cpu", "memory", "gpu", "disk", "network", "processes", "settings"];

export function readQuery(search: string): BootQuery {
  const q = new URLSearchParams(search);
  const page = PAGES.includes(q.get("page") as Page) ? (q.get("page") as Page) : "overview";
  const theme = isTheme(q.get("theme")) ? (q.get("theme") as ThemeSetting) : undefined;
  const lang = isLang(q.get("lang")) ? (q.get("lang") as LangSetting) : undefined;
  const tick = Number(q.get("tick"));
  const interval = Number(q.get("interval"));
  return {
    page,
    theme,
    lang,
    shot: q.get("shot") === "1",
    tick: Number.isFinite(tick) ? tick : 72,
    intervalMs: INTERVALS.includes(interval as IntervalMs) ? (interval as IntervalMs) : undefined,
  };
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function browserDemo(search = window.location.search): boolean {
  const q = new URLSearchParams(search);
  if (q.get("demo") === "1") return true;
  if (q.get("demo") === "0") return false;
  if (import.meta.env.VITE_DEMO === "1") return true;
  return !isTauri();
}

export function hiddenInterval(intervalMs: IntervalMs, hidden: boolean, slow: boolean): number {
  if (hidden && slow) return Math.max(intervalMs * 4, 2000);
  return intervalMs;
}
