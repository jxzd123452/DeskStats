import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang, MessageKey } from "./i18n";
import {
  ALERT_STORAGE_KEY,
  HISTORY_LIMIT,
  clearPending,
  directionFor,
  formatSpan,
  historyFromFire,
  loadAlertStore,
  readingsFromSnapshot,
  resetRuleRuntime,
  sanitizeRule,
  stepAlerts,
  unitFor,
  type AlertHistoryItem,
  type AlertMetric,
  type AlertRule,
} from "./lib/alerts";
import { ensureNotificationPermission, notifyNative } from "./lib/notify";
import type { Snapshot } from "./types";

function readRaw(): string | null {
  try {
    return localStorage.getItem(ALERT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function metricMessage(metric: AlertMetric): MessageKey {
  switch (metric) {
    case "cpu":
      return "metric.cpu";
    case "memory":
      return "metric.memory";
    case "gpu":
      return "metric.gpu";
    case "temperature":
      return "metric.temperature";
    case "diskFree":
      return "metric.diskFree";
    case "battery":
      return "metric.battery";
  }
}

export function useAlerts({
  active,
  shot,
  paused,
  snap,
  lang,
  t,
}: {
  active: boolean;
  shot: boolean;
  paused: boolean;
  snap: Snapshot;
  lang: Lang;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}) {
  const [loaded] = useState(() => loadAlertStore(readRaw()));
  const [rules, setRules] = useState<AlertRule[]>(loaded.rules);
  const [history, setHistory] = useState<AlertHistoryItem[]>(loaded.history);
  const runtimeRef = useRef(loaded.runtime);
  const rulesRef = useRef(rules);
  const historyRef = useRef(history);
  const timer = useRef(0);
  const tRef = useRef(t);
  const langRef = useRef(lang);

  useEffect(() => {
    rulesRef.current = rules;
    historyRef.current = history;
    tRef.current = t;
    langRef.current = lang;
  });

  const persist = useCallback(
    (nextRules: AlertRule[], nextHistory: AlertHistoryItem[], immediate: boolean) => {
      if (!active || shot) return;
      const write = () => {
        try {
          localStorage.setItem(
            ALERT_STORAGE_KEY,
            JSON.stringify({ rules: nextRules, history: nextHistory, runtime: runtimeRef.current }),
          );
        } catch {
          /* ignore quota */
        }
      };
      if (immediate) {
        window.clearTimeout(timer.current);
        write();
        return;
      }
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(write, 1000);
    },
    [active, shot],
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!active || shot) return;
    void ensureNotificationPermission();
  }, [active, shot]);

  useEffect(() => {
    if (!active || !paused) return;
    runtimeRef.current = clearPending(runtimeRef.current);
  }, [active, paused]);

  useEffect(() => {
    if (!active || shot || paused || snap.timestampMs === 0) return;
    const now = Date.now();
    const { state, fired } = stepAlerts(rulesRef.current, readingsFromSnapshot(snap), runtimeRef.current, now);
    runtimeRef.current = state;
    if (fired.length === 0) {
      persist(rulesRef.current, historyRef.current, false);
      return;
    }
    const nextHistory = [...fired.map(historyFromFire), ...historyRef.current].slice(0, HISTORY_LIMIT);
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    persist(rulesRef.current, nextHistory, true);
    const translate = tRef.current;
    for (const event of fired) {
      const rule = rulesRef.current.find((item) => item.id === event.ruleId);
      const key = directionFor(event.metric) === "above" ? "alertFiredAbove" : "alertFiredBelow";
      const body = translate(key, {
        name: translate(metricMessage(event.metric)),
        threshold: Math.round(event.threshold),
        value: Math.round(event.value),
        unit: unitFor(event.metric),
        hold: formatSpan(rule?.durationMs ?? 0, langRef.current),
      });
      void notifyNative(translate("alertNotifyTitle"), body);
    }
  }, [active, shot, paused, snap, persist]);

  const updateRule = useCallback(
    (id: string, patch: Partial<AlertRule>) => {
      const next = rulesRef.current.map((rule) =>
        rule.id === id ? sanitizeRule({ ...rule, ...patch, id: rule.id, metric: rule.metric }) : rule,
      );
      rulesRef.current = next;
      runtimeRef.current = resetRuleRuntime(runtimeRef.current, id);
      setRules(next);
      persist(next, historyRef.current, true);
    },
    [persist],
  );

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    setHistory([]);
    persist(rulesRef.current, [], true);
  }, [persist]);

  return { rules, history, updateRule, clearHistory };
}
