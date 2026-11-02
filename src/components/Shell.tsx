import type { CSSProperties, ReactNode } from "react";
import {
  Cpu,
  HardDrive,
  LayoutDashboard,
  MemoryStick,
  Minus,
  Moon,
  Network,
  Rows3,
  Settings,
  Square,
  Sun,
  X,
} from "lucide-react";
import type { MessageKey } from "../i18n";
import type { Page } from "../types";
import { GpuIcon, LogoMark } from "./ui";

const NAV: { page: Page; key: MessageKey; icon: ReactNode; color: string }[] = [
  { page: "overview", key: "nav.overview", icon: <LayoutDashboard size={18} />, color: "#4F8CFF" },
  { page: "cpu", key: "nav.cpu", icon: <Cpu size={18} />, color: "#4F8CFF" },
  { page: "memory", key: "nav.memory", icon: <MemoryStick size={18} />, color: "#A78BFA" },
  { page: "gpu", key: "nav.gpu", icon: <GpuIcon />, color: "#34D399" },
  { page: "disk", key: "nav.disk", icon: <HardDrive size={18} />, color: "#FBBF24" },
  { page: "network", key: "nav.network", icon: <Network size={18} />, color: "#22D3EE" },
  { page: "processes", key: "nav.processes", icon: <Rows3 size={18} />, color: "#F472B6" },
  { page: "settings", key: "nav.settings", icon: <Settings size={18} />, color: "#8B93A7" },
];

export function Shell({
  page,
  paused,
  theme,
  t,
  onNavigate,
  onTheme,
  onSettings,
  children,
}: {
  page: Page;
  paused: boolean;
  theme: "dark" | "light";
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  onNavigate: (page: Page) => void;
  onTheme: () => void;
  onSettings: () => void;
  children: ReactNode;
}) {
  return (
    <div className="app">
      <header className="titlebar" data-tauri-drag-region>
        <div className="brand" data-tauri-drag-region>
          <LogoMark />
          <span className="brand-name">DeskStats</span>
          <span className="brand-version">{t("brand.version")}</span>
          <span className={`live-pill ${paused ? "paused" : ""}`}>
            <span className="live-dot" />
            {paused ? t("paused") : t("live")}
          </span>
        </div>
        <div className="title-spacer" data-tauri-drag-region />
        <button className="icon-btn" data-tauri-drag-region="false" aria-label={t("action.theme")} onClick={onTheme}>
          {theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
        </button>
        <button className="icon-btn" data-tauri-drag-region="false" aria-label={t("action.settings")} onClick={onSettings}>
          <Settings size={15} />
        </button>
        <div className="win-group">
          <button className="win-btn" data-tauri-drag-region="false" aria-label={t("action.minimize")} onClick={() => void windowAction("minimize")}>
            <Minus size={14} />
          </button>
          <button className="win-btn" data-tauri-drag-region="false" aria-label={t("action.maximize")} onClick={() => void windowAction("toggle")}>
            <Square size={12} />
          </button>
          <button className="win-btn close" data-tauri-drag-region="false" aria-label={t("action.close")} onClick={() => void windowAction("close")}>
            <X size={15} />
          </button>
        </div>
      </header>
      <nav className="sidebar" aria-label="Primary">
        {NAV.map((item) => (
          <button
            key={item.page}
            className="nav-btn"
            style={{ "--nav": item.color } as CSSProperties}
            aria-current={page === item.page ? "page" : undefined}
            aria-label={t(item.key)}
            onClick={() => onNavigate(item.page)}
          >
            {item.icon}
            <span className="tip">{t(item.key)}</span>
          </button>
        ))}
      </nav>
      <main className={`main ${page === "overview" ? "" : "scroll"}`}>{children}</main>
    </div>
  );
}

async function windowAction(kind: "minimize" | "toggle" | "close") {
  if (!("__TAURI_INTERNALS__" in window)) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  if (kind === "minimize") await win.minimize();
  else if (kind === "toggle") await win.toggleMaximize();
  else await win.close();
}
