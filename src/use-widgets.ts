import { useCallback, useEffect, useState } from "react";
import { isTauri } from "./lib/settings";
import { mirrorBrowserPopups, syncWidgetWindows } from "./lib/widget-host";
import {
  closeWidget,
  isWidgetKind,
  loadWidgetState,
  serializeWidgetState,
  toggleWidget as toggleWidgetState,
  unlockWidgets,
  updateGeometry,
  updateWidget,
  WIDGET_STORAGE_KEY,
  type AppRole,
  type WidgetGeometry,
  type WidgetKind,
  type WidgetPatch,
  type WidgetState,
} from "./lib/widgets";

function readRaw(): string | null {
  try {
    return localStorage.getItem(WIDGET_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function useWidgets(role: AppRole, shot: boolean) {
  const [widgets, setWidgets] = useState<WidgetState>(() => loadWidgetState(readRaw()));

  const commit = useCallback(
    (mutator: (state: WidgetState) => WidgetState, sync: boolean) => {
      const base = loadWidgetState(readRaw());
      const next = mutator(base);
      if (next === base) return;
      const raw = serializeWidgetState(next);
      if (raw === readRaw()) return;
      try {
        localStorage.setItem(WIDGET_STORAGE_KEY, raw);
      } catch {
        /* ignore quota */
      }
      const normalized = loadWidgetState(raw);
      setWidgets(normalized);
      if (!sync || shot) return;
      if (isTauri()) void syncWidgetWindows(normalized.widgets);
      else mirrorBrowserPopups(base, normalized);
    },
    [shot],
  );

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== WIDGET_STORAGE_KEY) return;
      setWidgets(loadWidgetState(event.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (role.type !== "main" || shot || !isTauri()) return;
    void syncWidgetWindows(loadWidgetState(readRaw()).widgets);
    let stop = () => {};
    let timer = 0;
    let pending: WidgetGeometry | null = null;
    let cancelled = false;
    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const stops = await Promise.all([
        listen<string>("widget-closed", (event) => {
          const kind = event.payload;
          if (!isWidgetKind(kind)) return;
          commit((state) => closeWidget(state, kind), false);
        }),
        listen<string>("widget-toggle", (event) => {
          const kind = event.payload;
          if (!isWidgetKind(kind)) return;
          commit((state) => toggleWidgetState(state, kind), true);
        }),
        listen("widget-unlock", () => {
          commit((state) => unlockWidgets(state), true);
        }),
        listen<WidgetGeometry>("widget-geometry", (event) => {
          pending = event.payload;
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            const geometry = pending;
            if (!geometry) return;
            commit((state) => updateGeometry(state, geometry), false);
          }, 160);
        }),
      ]);
      if (cancelled) stops.forEach((fn) => fn());
      else stop = () => stops.forEach((fn) => fn());
    })();
    return () => {
      cancelled = true;
      stop();
      window.clearTimeout(timer);
    };
  }, [role.type, shot, commit]);

  const toggleWidget = useCallback(
    (kind: WidgetKind, open?: boolean) => {
      commit((state) => toggleWidgetState(state, kind, open), true);
    },
    [commit],
  );

  const patchWidget = useCallback(
    (kind: WidgetKind, patch: WidgetPatch, sync: boolean) => {
      commit((state) => updateWidget(state, kind, patch), sync);
    },
    [commit],
  );

  return { widgets, toggleWidget, patchWidget };
}
