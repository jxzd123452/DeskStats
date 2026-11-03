import type { CSSProperties } from "react";
import { WidgetFace } from "../components/WidgetFace";
import { LogoMark } from "../components/ui";
import type { WidgetKind } from "../lib/widgets";
import { useDesk } from "../state";

const SLOTS: { kind: WidgetKind; className: string; opacity: number }[] = [
  { kind: "cpu", className: "cpu", opacity: 0.92 },
  { kind: "network", className: "network", opacity: 0.9 },
  { kind: "gpu", className: "gpu", opacity: 0.92 },
  { kind: "memory", className: "memory", opacity: 0.9 },
  { kind: "sensors", className: "sensors", opacity: 0.9 },
];

export function DesktopScene() {
  const { snap, history, accents, t, lang, shot } = useDesk();
  const clock = shot
    ? lang === "zh"
      ? "周二 09:41"
      : "Tue 09:41"
    : new Date().toLocaleTimeString(lang === "zh" ? "zh-CN" : "en-GB", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="desk">
      <div className="ghost-win editor" aria-hidden="true">
        <div className="ghost-title">
          <i /><i /><i />
          <span>monitor.rs</span>
        </div>
        <div className="ghost-lines">
          {[72, 48, 86, 40, 64, 55, 78, 34, 60, 44].map((width, index) => (
            <span key={width + index} style={{ width: `${width}%`, "--line": index % 3 === 0 ? accents.cpu : index % 3 === 1 ? accents.memory : accents.down } as CSSProperties} />
          ))}
        </div>
      </div>
      <div className="ghost-win photo" aria-hidden="true">
        <div className="ghost-title"><span>dusk.jpg</span></div>
        <div className="photo-sky" />
        <div className="photo-land" />
      </div>
      {SLOTS.map((slot) => (
        <div key={slot.kind} className={`desk-slot ${slot.className}`}>
          <WidgetFace
            kind={slot.kind}
            snap={snap}
            history={history}
            accents={accents}
            t={t}
            opacity={slot.opacity}
            mode="top"
            locked={false}
            interactive={false}
          />
        </div>
      ))}
      <footer className="desk-bar">
        <div className="desk-start">
          <LogoMark />
          <span>DeskStats</span>
        </div>
        <div className="desk-pips" aria-hidden="true">
          <i /><i /><i /><i />
        </div>
        <div className="desk-clock">
          <span>{snap.system.hostname || "Desk"}</span>
          <strong className="num">{clock}</strong>
        </div>
      </footer>
    </div>
  );
}
