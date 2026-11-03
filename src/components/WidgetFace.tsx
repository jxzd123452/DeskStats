import type { CSSProperties } from "react";
import { Lock, PictureInPicture2, Pin, PinOff, X } from "lucide-react";
import type { MessageKey } from "../i18n";
import { formatBytes, formatGhz, formatRate, percentOf } from "../lib/format";
import { isTauri } from "../lib/settings";
import { beginWidgetResize } from "../lib/widget-host";
import type { WidgetKind, WidgetMode } from "../lib/widgets";
import type { AccentSet } from "../theme";
import type { Sample, Snapshot } from "../types";
import { Sparkline } from "./Sparkline";
import { Meter } from "./ui";

export function widgetAccent(kind: WidgetKind, accents: AccentSet): string {
  switch (kind) {
    case "cpu":
      return accents.cpu;
    case "memory":
      return accents.memory;
    case "gpu":
      return accents.gpu;
    case "network":
      return accents.down;
    case "disks":
      return accents.disk;
    case "sensors":
      return accents.temp;
  }
}

export function WidgetFace({
  kind,
  snap,
  history,
  accents,
  t,
  opacity,
  mode,
  locked,
  interactive,
  onClose,
  onToggleMode,
  onToggleLock,
}: {
  kind: WidgetKind;
  snap: Snapshot;
  history: Sample[];
  accents: AccentSet;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  opacity: number;
  mode: WidgetMode;
  locked: boolean;
  interactive: boolean;
  onClose?: () => void;
  onToggleMode?: () => void;
  onToggleLock?: () => void;
}) {
  const accent = widgetAccent(kind, accents);
  const alpha = `${Math.round(opacity * 100)}%`;
  return (
    <div className={`widget-app ${interactive ? "" : "in-scene"} ${locked ? "locked" : ""}`}>
      <section
        className="widget-frame"
        data-tauri-drag-region={interactive && !locked ? true : undefined}
        style={{ "--accent": accent, "--widget-alpha": alpha } as CSSProperties}
      >
        <header className="widget-top" data-tauri-drag-region={interactive && !locked ? true : undefined}>
          <div className="kicker">
            <span className="dot" />
            {t(`metric.${kind}`)}
          </div>
          {locked ? <Lock size={12} className="widget-lock-mark" aria-hidden="true" /> : null}
        </header>
        <WidgetBody kind={kind} snap={snap} history={history} accents={accents} accent={accent} t={t} />
        {interactive && !locked ? (
          <div className="widget-toolbar" data-tauri-drag-region="false">
            <button
              type="button"
              data-tauri-drag-region="false"
              aria-label={mode === "desktop" ? t("widgetTop") : t("widgetDesktop")}
              aria-pressed={mode === "desktop"}
              onClick={onToggleMode}
            >
              {mode === "desktop" ? <PinOff size={13} /> : <Pin size={13} />}
            </button>
            <button type="button" data-tauri-drag-region="false" aria-label={t("widgetLock")} aria-pressed={locked} onClick={onToggleLock}>
              <Lock size={13} />
            </button>
            <button type="button" data-tauri-drag-region="false" aria-label={t("popIn")} onClick={onClose}>
              <X size={13} />
            </button>
          </div>
        ) : null}
        {interactive && !locked && isTauri() ? (
          <button
            type="button"
            className="widget-grip"
            data-tauri-drag-region="false"
            aria-label={t("widgetResize")}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void beginWidgetResize();
            }}
          />
        ) : null}
      </section>
    </div>
  );
}

function WidgetBody({
  kind,
  snap,
  history,
  accents,
  accent,
  t,
}: {
  kind: WidgetKind;
  snap: Snapshot;
  history: Sample[];
  accents: AccentSet;
  accent: string;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}) {
  const tail = history.slice(-48);
  if (kind === "cpu") {
    const ghz = formatGhz(snap.cpu.frequencyMhz);
    return (
      <>
        <Hero value={whole(snap.cpu.usage)} unit="%" />
        <div className="widget-sub truncate">
          {snap.cpu.logicalCores || "—"} {t("cores")}
          {ghz ? ` · ${ghz} GHz` : ""}
        </div>
        <Sparkline series={[{ values: tail.map((sample) => sample.cpu), color: accent }]} min={0} max={100} />
      </>
    );
  }
  if (kind === "memory") {
    const pct = snap.memory.total ? percentOf(snap.memory.used, snap.memory.total) : null;
    const used = formatBytes(snap.memory.used);
    const total = formatBytes(snap.memory.total);
    return (
      <>
        <Hero value={pct == null ? "—" : whole(pct)} unit="%" />
        <div className="widget-sub truncate">
          {snap.memory.total ? `${used.value} / ${total.value} ${total.unit}` : t("widgetNoReading")}
        </div>
        <Sparkline series={[{ values: tail.map((sample) => sample.mem), color: accent }]} min={0} max={100} />
      </>
    );
  }
  if (kind === "gpu") {
    const gpu = snap.gpus[0];
    return (
      <>
        <Hero value={gpu?.usage == null ? "—" : whole(gpu.usage)} unit="%" />
        <div className="widget-sub truncate">
          {gpu ? gpu.name : t("noGpu")}
          {gpu?.temperatureC != null ? ` · ${gpu.temperatureC.toFixed(0)}°` : ""}
        </div>
        <Sparkline series={[{ values: tail.map((sample) => sample.gpu), color: accent }]} min={0} max={100} />
      </>
    );
  }
  if (kind === "network") {
    const down = formatRate(snap.network.downBps);
    const up = formatRate(snap.network.upBps);
    return (
      <>
        <div className="widget-pair">
          <div>
            <div className="widget-pair-label"><i style={{ background: accents.down }} />{t("down")}</div>
            <div className="widget-pair-value num" style={{ color: accents.down }}>{down.value}</div>
            <div className="widget-sub">{down.unit}</div>
          </div>
          <div>
            <div className="widget-pair-label"><i style={{ background: accents.up }} />{t("up")}</div>
            <div className="widget-pair-value num" style={{ color: accents.up }}>{up.value}</div>
            <div className="widget-sub">{up.unit}</div>
          </div>
        </div>
        <Sparkline
          series={[
            { values: tail.map((sample) => sample.down), color: accents.down },
            { values: tail.map((sample) => sample.up), color: accents.up },
          ]}
        />
      </>
    );
  }
  if (kind === "disks") {
    const disks = snap.disks.slice(0, 2);
    const primary = disks[0];
    if (!primary) {
      return <div className="widget-empty">{t("noDisks")}</div>;
    }
    const free = formatBytes(Math.max(0, primary.total - primary.used));
    const pct = percentOf(primary.used, primary.total);
    return (
      <>
        <Hero value={free.value} unit={free.unit} />
        <div className="widget-sub truncate">{primary.mount} · {pct.toFixed(0)}% {t("used")}</div>
        <Meter value={pct} color={accent} />
        {disks[1] ? (
          <div className="widget-sub truncate">
            {disks[1].mount} · {formatBytes(Math.max(0, disks[1].total - disks[1].used)).value} {t("free")}
          </div>
        ) : null}
      </>
    );
  }
  const temps = [...snap.temperatures].sort((a, b) => b.celsius - a.celsius).slice(0, 3);
  const hottest = temps[0];
  if (!hottest) return <div className="widget-empty">{t("widgetNoReading")}</div>;
  return (
    <>
      <Hero value={whole(hottest.celsius)} unit="°" />
      <div className="widget-sub truncate">{hottest.label}</div>
      <div className="widget-sensors">
        {temps.slice(1).map((temp) => (
          <div key={temp.label} className="widget-sensor">
            <span className="truncate">{temp.label}</span>
            <span className="num">{temp.celsius.toFixed(0)}°</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Hero({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="widget-hero" data-tauri-drag-region>
      <span className="widget-value num">{value}</span>
      <span className="widget-unit">{unit}</span>
    </div>
  );
}

function whole(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return Math.round(value).toString();
}

export function PopIcon() {
  return <PictureInPicture2 size={13} />;
}
