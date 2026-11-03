import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Card, Kicker } from "../components/ui";
import type { MessageKey } from "../i18n";
import {
  COOLDOWN_PRESETS,
  HOLD_PRESETS,
  directionFor,
  formatSpan,
  screenshotHistory,
  unitFor,
  type AlertMetric,
  type AlertRule,
} from "../lib/alerts";
import { INTERVALS } from "../lib/format";
import { readQuery, type SettingsPanel } from "../lib/settings";
import type { AccentSet } from "../theme";
import { placementOf, WIDGET_KINDS } from "../lib/widgets";
import { useDesk } from "../state";
import type { IntervalMs } from "../types";

const ALERTS: { id: string; metric: AlertMetric; hint: MessageKey }[] = [
  { id: "cpu", metric: "cpu", hint: "alertCpuHint" },
  { id: "memory", metric: "memory", hint: "alertMemoryHint" },
  { id: "gpu", metric: "gpu", hint: "alertGpuHint" },
  { id: "temperature", metric: "temperature", hint: "alertTempHint" },
  { id: "diskFree", metric: "diskFree", hint: "alertDiskHint" },
  { id: "battery", metric: "battery", hint: "alertBatteryHint" },
];

export function SettingsPage() {
  const boot = useMemo(() => readQuery(window.location.search), []);
  const [panel, setPanel] = useState<SettingsPanel>(boot.panel);
  const desk = useDesk();
  return (
    <div className="settings">
      <div className="settings-nav" role="tablist">
        <Tab pressed={panel === "general"} onClick={() => setPanel("general")}>{desk.t("settingsGeneral")}</Tab>
        <Tab pressed={panel === "widgets"} onClick={() => setPanel("widgets")}>{desk.t("settingsWidgets")}</Tab>
        <Tab pressed={panel === "alerts"} onClick={() => setPanel("alerts")}>{desk.t("settingsAlerts")}</Tab>
      </div>
      {panel === "general" ? <GeneralSettings /> : null}
      {panel === "widgets" ? <WidgetsSettings /> : null}
      {panel === "alerts" ? <AlertsSettings shot={desk.shot} /> : null}
    </div>
  );
}

function GeneralSettings() {
  const { settings, updateSettings, accents, t, paused, setPaused, snap } = useDesk();
  return (
    <>
      <Card accent={accents.cpu}>
        <Kicker>{t("appearance")}</Kicker>
        <div className="setting-row">
          <div className="setting-copy"><h3>{t("theme")}</h3></div>
          <div className="seg">
            <Seg pressed={settings.theme === "system"} onClick={() => updateSettings({ theme: "system" })}>{t("themeSystem")}</Seg>
            <Seg pressed={settings.theme === "dark"} onClick={() => updateSettings({ theme: "dark" })}>{t("themeDark")}</Seg>
            <Seg pressed={settings.theme === "light"} onClick={() => updateSettings({ theme: "light" })}>{t("themeLight")}</Seg>
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-copy"><h3>{t("language")}</h3></div>
          <div className="seg">
            <Seg pressed={settings.lang === "system"} onClick={() => updateSettings({ lang: "system" })}>{t("langSystem")}</Seg>
            <Seg pressed={settings.lang === "en"} onClick={() => updateSettings({ lang: "en" })}>{t("langEn")}</Seg>
            <Seg pressed={settings.lang === "zh"} onClick={() => updateSettings({ lang: "zh" })}>{t("langZh")}</Seg>
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-copy"><h3>{t("reduceMotion")}</h3></div>
          <Switch on={settings.reduceMotion} label={t("reduceMotion")} onClick={() => updateSettings({ reduceMotion: !settings.reduceMotion })} />
        </div>
      </Card>

      <Card accent={accents.down}>
        <Kicker>{t("sampling")}</Kicker>
        <div className="setting-row">
          <div className="setting-copy"><h3>{t("interval")}</h3></div>
          <div className="seg">
            {INTERVALS.map((ms) => (
              <Seg key={ms} pressed={settings.intervalMs === ms} onClick={() => updateSettings({ intervalMs: ms as IntervalMs })}>
                {ms / 1000}s
              </Seg>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-copy">
            <h3>{t("slowHidden")}</h3>
            <p>{t("slowHiddenHint")}</p>
          </div>
          <Switch on={settings.slowWhenHidden} label={t("slowHidden")} onClick={() => updateSettings({ slowWhenHidden: !settings.slowWhenHidden })} />
        </div>
        <div className="setting-row">
          <div className="setting-copy"><h3>{paused ? t("resume") : t("pausedSampling")}</h3></div>
          <Switch on={paused} label={t("pausedSampling")} onClick={() => setPaused(!paused)} />
        </div>
      </Card>

      <Card accent={accents.memory}>
        <Kicker>{t("behavior")}</Kicker>
        <div className="setting-row">
          <div className="setting-copy">
            <h3>{t("closeToTray")}</h3>
            <p>{t("closeToTrayHint")}</p>
          </div>
          <Switch on={settings.closeToTray} label={t("closeToTray")} onClick={() => updateSettings({ closeToTray: !settings.closeToTray })} />
        </div>
      </Card>

      <Card accent={accents.disk}>
        <Kicker>{t("about")}</Kicker>
        <div className="setting-row">
          <div className="setting-copy">
            <h3>DeskStats</h3>
            <p>{t("aboutBody")}</p>
          </div>
          <span className="num">1.0.0</span>
        </div>
        <div className="setting-row">
          <div className="setting-copy"><h3>{snap.demo ? t("demoMode") : t("realMode")}</h3></div>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>{t("tempNote")}</p>
      </Card>
    </>
  );
}

function WidgetsSettings() {
  const { widgets, toggleWidget, patchWidget, accents, t } = useDesk();
  return (
    <Card accent={accents.cpu}>
      <Kicker>{t("settingsWidgets")}</Kicker>
      <p className="setting-lead">{t("widgetsHint")}</p>
      <p className="setting-lead muted">{t("widgetLockHint")}</p>
      {WIDGET_KINDS.map((kind) => {
        const placement = placementOf(widgets, kind);
        return (
          <div key={kind} className="setting-row widget-setting">
            <div className="setting-copy">
              <h3>{t(`metric.${kind}`)}</h3>
              {placement.open ? (
                <div className="widget-controls">
                  <div className="seg">
                    <Seg pressed={placement.mode === "top"} onClick={() => patchWidget(kind, { mode: "top" }, true)}>{t("widgetTop")}</Seg>
                    <Seg pressed={placement.mode === "desktop"} onClick={() => patchWidget(kind, { mode: "desktop" }, true)}>{t("widgetDesktop")}</Seg>
                  </div>
                  <label className="opacity-field">
                    <span>{t("widgetOpacity")}</span>
                    <input
                      type="range"
                      min={35}
                      max={100}
                      value={Math.round(placement.opacity * 100)}
                      aria-label={t("widgetOpacity")}
                      onChange={(event) => patchWidget(kind, { opacity: Number(event.target.value) / 100 }, false)}
                    />
                    <span className="num">{Math.round(placement.opacity * 100)}%</span>
                  </label>
                  <label className="lock-field">
                    <span>{t("widgetLock")}</span>
                    <Switch
                      on={placement.clickThrough}
                      label={t("widgetLock")}
                      onClick={() => patchWidget(kind, { clickThrough: !placement.clickThrough }, true)}
                    />
                  </label>
                </div>
              ) : null}
            </div>
            <Switch on={placement.open} label={t(`metric.${kind}`)} onClick={() => toggleWidget(kind)} />
          </div>
        );
      })}
    </Card>
  );
}

function AlertsSettings({ shot }: { shot: boolean }) {
  const { alertRules: rules, alertHistory: history, clearAlertHistory: clearHistory, accents, t, lang } = useDesk();
  const shown = shot ? screenshotHistory() : history;
  return (
    <>
      <Card accent={accents.warn} id="alerts">
        <Kicker>{t("settingsAlerts")}</Kicker>
        <p className="setting-lead">{t("alertIntro")}</p>
        <p className="setting-lead muted">{t("alertHysteresisNote")}</p>
        {ALERTS.map((meta) => {
          const rule = rules.find((item) => item.id === meta.id);
          if (!rule) return null;
          return (
            <AlertRow key={meta.id} rule={rule} hint={meta.hint} accents={accents} />
          );
        })}
      </Card>
      <Card accent={accents.temp}>
        <div className="card-head">
          <Kicker>{t("alertHistory")}</Kicker>
          <button type="button" className="linkish" onClick={clearHistory} disabled={shown.length === 0}>{t("alertClear")}</button>
        </div>
        {shown.length === 0 ? <p className="setting-lead">{t("alertHistoryEmpty")}</p> : null}
        <ul className="alert-history">
          {shown.map((item) => {
            const accent = alertAccent(item.metric, accents);
            return (
              <li key={item.id}>
                <span className="num alert-time">{formatClock(item.at, shot)}</span>
                <span className="alert-dot" style={{ "--accent": accent } as CSSProperties} />
                <span className="alert-name-inline">{t(metricLabel(item.metric))}</span>
                <span className="num">{Math.round(item.value)}{unitFor(item.metric)}</span>
                <span className="muted">
                  {t(directionFor(item.metric) === "above" ? "alertAbove" : "alertBelow")} {Math.round(item.threshold)}{unitFor(item.metric)}
                  {" · "}
                  {formatSpan(rules.find((rule) => rule.id === item.ruleId)?.durationMs ?? 30_000, lang)}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}

function AlertRow({ rule, hint, accents }: { rule: AlertRule; hint: MessageKey; accents: AccentSet }) {
  const { updateAlertRule: updateRule, t, lang } = useDesk();
  const above = directionFor(rule.metric) === "above";
  const unit = unitFor(rule.metric);
  const accent = alertAccent(rule.metric, accents);
  const holds = withCurrent(HOLD_PRESETS, rule.durationMs);
  const cooldowns = withCurrent(COOLDOWN_PRESETS, rule.cooldownMs);
  return (
    <div className={`alert-rule ${rule.enabled ? "" : "off"}`} style={{ "--accent": accent } as CSSProperties}>
      <div className="alert-name">
        <h3>{t(metricLabel(rule.metric))}</h3>
        <p>{t(hint)}</p>
      </div>
      <label className="inline-field">
        <span>{t(above ? "alertAbove" : "alertBelow")}</span>
        <input
          className="num"
          type="number"
          inputMode="numeric"
          aria-label={t("alertThreshold")}
          value={rule.threshold}
          disabled={!rule.enabled}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (!Number.isFinite(value)) return;
            updateRule(rule.id, { threshold: value });
          }}
        />
        <span>{unit}</span>
      </label>
      <label className="inline-field">
        <span>{t("alertHold")}</span>
        <select
          aria-label={t("alertHold")}
          value={rule.durationMs}
          disabled={!rule.enabled}
          onChange={(event) => updateRule(rule.id, { durationMs: Number(event.target.value) })}
        >
          {holds.map((ms) => (
            <option key={ms} value={ms}>{formatSpan(ms, lang)}</option>
          ))}
        </select>
      </label>
      <label className="inline-field">
        <span>{t("alertCooldown")}</span>
        <select
          aria-label={t("alertCooldown")}
          value={rule.cooldownMs}
          disabled={!rule.enabled}
          onChange={(event) => updateRule(rule.id, { cooldownMs: Number(event.target.value) })}
        >
          {cooldowns.map((ms) => (
            <option key={ms} value={ms}>{formatSpan(ms, lang)}</option>
          ))}
        </select>
      </label>
      <Switch on={rule.enabled} label={t(metricLabel(rule.metric))} onClick={() => updateRule(rule.id, { enabled: !rule.enabled })} />
    </div>
  );
}

function metricLabel(metric: AlertMetric): MessageKey {
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

function alertAccent(metric: AlertMetric, accents: AccentSet): string {
  switch (metric) {
    case "cpu":
      return accents.cpu;
    case "memory":
      return accents.memory;
    case "gpu":
      return accents.gpu;
    case "temperature":
      return accents.temp;
    case "diskFree":
      return accents.disk;
    case "battery":
      return accents.battery;
  }
}

function withCurrent(presets: number[], current: number): number[] {
  if (presets.includes(current)) return presets;
  return [...presets, current].sort((a, b) => a - b);
}

function formatClock(ms: number, utc: boolean): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: utc ? "UTC" : undefined,
  }).format(ms);
}

function Tab({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={pressed} onClick={onClick}>
      {children}
    </button>
  );
}

function Seg({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" className="switch" aria-pressed={on} aria-label={label} onClick={onClick}>
      <i />
    </button>
  );
}
