import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

export function Card({
  accent,
  className,
  children,
  id,
}: {
  accent: string;
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <article id={id} className={`card ${className ?? ""}`} style={{ "--accent": accent } as CSSProperties}>
      {children}
    </article>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="kicker">
      <span className="dot" />
      {children}
    </div>
  );
}

export function Ring({
  value,
  color,
  size = 92,
  stroke = 8,
  children,
}: {
  value: number;
  color: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  const offset = c * (1 - pct / 100);
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function Meter({ value, color }: { value: number; color?: string }) {
  const pct = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <div className="bar" aria-hidden="true">
      <span style={{ width: `${pct}%`, background: color ?? "var(--accent)" }} />
    </div>
  );
}

export function BigStat({
  value,
  unit,
  size = "lg",
  children,
}: {
  value?: string;
  unit?: string;
  size?: "lg" | "sm";
  children?: ReactNode;
}) {
  return (
    <div className={`big ${size === "sm" ? "sm" : ""}`}>
      <span className="num">{children ?? value}</span>
      {unit ? <span className="unit">{unit}</span> : null}
    </div>
  );
}

export function useAnimatedNumber(value: number, enabled: boolean): number {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (!enabled || !Number.isFinite(value)) {
      from.current = value;
      return;
    }
    const start = performance.now();
    const initial = from.current;
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 200);
      const eased = 1 - (1 - t) ** 3;
      const next = initial + (value - initial) * eased;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(step);
      else from.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, enabled]);
  return enabled ? display : value;
}

export function AnimatedPercent({ value, digits = 1, enabled }: { value: number; digits?: number; enabled: boolean }) {
  const shown = useAnimatedNumber(value, enabled);
  return <>{Number.isFinite(shown) ? shown.toFixed(digits) : "—"}</>;
}

export function HeatGrid({
  cells,
  accent,
}: {
  cells: { id: number; usage: number }[];
  accent: string;
}) {
  const columns =
    cells.length > 12
      ? "repeat(auto-fit, minmax(42px, 1fr))"
      : `repeat(${Math.max(cells.length, 1)}, minmax(0, 1fr))`;
  return (
    <div className="heat" style={{ gridTemplateColumns: columns }}>
      {cells.map((cell) => {
        const mix = Math.max(10, Math.min(100, cell.usage));
        const lightText = mix > 58;
        return (
          <div
            key={cell.id}
            className="heat-cell"
            style={{
              background: `color-mix(in srgb, ${accent} ${mix}%, var(--heat-base))`,
              color: lightText ? "#f8fafc" : "var(--text)",
            }}
          >
            <span className="id">{cell.id}</span>
            <span className="pct num">{cell.usage.toFixed(0)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  const palette = ["#4F8CFF", "#A78BFA", "#34D399", "#FBBF24", "#22D3EE", "#F472B6", "#FB7185"];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const color = palette[hash % palette.length];
  return (
    <span className="avatar" style={{ "--avatar": color } as CSSProperties}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Qty({ bytes, rate = false }: { bytes: number; rate?: boolean }) {
  const safe = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = safe;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const text = i === 0 ? String(Math.round(value)) : value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2);
  return (
    <span className="num">
      {text}
      <span className="muted"> {units[i]}{rate ? "/s" : ""}</span>
    </span>
  );
}

export function Dialog({
  open,
  title,
  body,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="dialog-title">{title}</h2>
        <p>{body}</p>
        <div className="modal-actions">
          <button className="btn quiet" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="btn danger" onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toast({ text }: { text: string | null }) {
  if (!text) return null;
  return <div className="toast" role="status">{text}</div>;
}

export function LogoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <rect x="0.6" y="0.6" width="16.8" height="16.8" rx="5" fill="#121722" stroke="rgba(255,255,255,0.14)" />
      <path d="M3.2 12.2 C5 11.2 6.1 8.4 7.4 8.4 C8.6 8.4 9.1 10.6 10.4 10.6 C12.2 10.6 13.1 6.2 15 5.2" fill="none" stroke="#4F8CFF" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="13.6" cy="5.5" r="1.15" fill="#A78BFA" />
    </svg>
  );
}

export function GpuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="7" width="14" height="10" rx="2" />
      <path d="M17 10h2.5a1.5 1.5 0 0 1 1.5 1.5V16" />
      <path d="M7 17v2M11 17v2M8 10.5h4" />
    </svg>
  );
}
