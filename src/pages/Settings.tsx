import { Card, Kicker } from "../components/ui";
import { INTERVALS } from "../lib/format";
import type { IntervalMs } from "../types";
import { useDesk } from "../state";

export function SettingsPage() {
  const { settings, updateSettings, accents, t, paused, setPaused, snap } = useDesk();
  return (
    <div className="settings">
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
          <Switch
            on={settings.reduceMotion}
            label={t("reduceMotion")}
            onClick={() => updateSettings({ reduceMotion: !settings.reduceMotion })}
          />
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
          <Switch
            on={settings.slowWhenHidden}
            label={t("slowHidden")}
            onClick={() => updateSettings({ slowWhenHidden: !settings.slowWhenHidden })}
          />
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
          <Switch
            on={settings.closeToTray}
            label={t("closeToTray")}
            onClick={() => updateSettings({ closeToTray: !settings.closeToTray })}
          />
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
    </div>
  );
}

function Seg({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button className="switch" aria-pressed={on} aria-label={label} onClick={onClick}>
      <i />
    </button>
  );
}
