import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { translate, type Lang, type MessageKey } from "./i18n";
import { demoSnapshot, SHOT_TICK } from "./lib/demo";
import { appendSample, sampleFrom } from "./lib/history";
import {
  browserDemo,
  hiddenInterval,
  isTauri,
  loadSettings,
  readQuery,
  resolveLang,
  saveSettings,
} from "./lib/settings";
import { ACCENTS, type AccentSet } from "./theme";
import type { HostMeta, Page, ProcessInfo, Sample, Settings, Snapshot } from "./types";

interface DeskContext {
  page: Page;
  setPage: (page: Page) => void;
  snap: Snapshot;
  history: Sample[];
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  theme: "dark" | "light";
  lang: Lang;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  accents: AccentSet;
  motion: boolean;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  toggleTheme: () => void;
  requestKill: (proc: ProcessInfo) => void;
  confirm: ProcessInfo | null;
  cancelKill: () => void;
  confirmKill: () => void;
  toast: string | null;
  shot: boolean;
  loading: boolean;
}

const Ctx = createContext<DeskContext | null>(null);

function seed(tick: number, killed: Set<number>) {
  const history: Sample[] = [];
  for (let i = 89; i >= 0; i -= 1) history.push(sampleFrom(demoSnapshot(tick - i, killed)));
  return { snap: demoSnapshot(tick, killed), history };
}

export function DeskProvider({ children }: { children: ReactNode }) {
  const query = useMemo(() => readQuery(window.location.search), []);
  const demo = useMemo(() => browserDemo(), []);
  const [settings, setSettings] = useState<Settings>(() => {
    const stored = loadSettings();
    return {
      ...stored,
      theme: query.theme ?? (query.shot ? "dark" : stored.theme),
      lang: query.lang ?? stored.lang,
      intervalMs: query.intervalMs ?? stored.intervalMs,
    };
  });
  const [page, setPage] = useState<Page>(query.page);
  const initialTick = query.shot ? query.tick || SHOT_TICK : SHOT_TICK;
  const killed = useRef(new Set<number>());
  const tick = useRef(initialTick);
  const [snap, setSnap] = useState<Snapshot>(() => (demo ? seed(initialTick, new Set()).snap : emptyClient()));
  const [history, setHistory] = useState<Sample[]>(() => (demo ? seed(initialTick, new Set()).history : []));
  const [paused, setPausedState] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ProcessInfo | null>(null);
  const [systemLight, setSystemLight] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: light)").matches ?? false,
  );

  const theme = settings.theme === "system" ? (systemLight ? "light" : "dark") : settings.theme;
  const lang = resolveLang(settings.lang);
  const accents = ACCENTS[theme];
  const motion = !settings.reduceMotion && !query.shot;

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.lang = lang === "zh" ? "zh-CN" : "en";
    root.classList.toggle("reduce-motion", settings.reduceMotion || query.shot);
    root.classList.toggle("is-shot", query.shot);
  }, [theme, lang, settings.reduceMotion, query.shot]);

  useEffect(() => {
    const root = document.documentElement;
    const frame = requestAnimationFrame(() => {
      root.dataset.ready = "1";
    });
    return () => cancelAnimationFrame(frame);
  }, [theme, lang, settings.reduceMotion, query.shot]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!media) return;
    const onChange = () => setSystemLight(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!query.shot) saveSettings(settings);
  }, [settings, query.shot]);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );

  useEffect(() => {
    if (!demo || query.shot) return;
    let timer = 0;
    const period = () => hiddenInterval(settings.intervalMs, document.hidden, settings.slowWhenHidden);
    const tickOnce = () => {
      if (paused) return;
      tick.current += 1;
      const next = demoSnapshot(tick.current, killed.current);
      setSnap(next);
      setHistory((prev) => appendSample(prev, next));
    };
    const arm = () => {
      window.clearInterval(timer);
      timer = window.setInterval(tickOnce, period());
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", arm);
    };
  }, [demo, query.shot, settings.intervalMs, settings.slowWhenHidden, paused]);

  useEffect(() => {
    if (demo || !isTauri()) return;
    let stop = () => {};
    let cancelled = false;
    void (async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");
      const meta = await invoke<HostMeta>("host_meta");
      if (cancelled) return;
      document.documentElement.dataset.material = meta.material;
      const initial = await invoke<Snapshot>("get_snapshot");
      if (initial.timestampMs > 0) {
        setSnap(initial);
        setHistory(initial.demo ? seed(SHOT_TICK, new Set()).history : appendSample([], initial));
      }
      const unlisten = await listen<Snapshot>("snapshot", (event) => {
        setSnap(event.payload);
        setPausedState(event.payload.paused);
        if (!event.payload.paused) setHistory((prev) => appendSample(prev, event.payload));
      });
      if (cancelled) unlisten();
      else stop = unlisten;
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [demo]);

  useEffect(() => {
    if (demo || !isTauri()) return;
    void (async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("apply_settings", {
        settings: {
          intervalMs: settings.intervalMs,
          slowWhenHidden: settings.slowWhenHidden,
          closeToTray: settings.closeToTray,
        },
      });
      await invoke("set_window_theme", { theme });
      await invoke("set_paused", { paused });
      await invoke("set_tray_labels", {
        labels: {
          show: translate(lang, "trayShow"),
          pause: translate(lang, "trayPause"),
          resume: translate(lang, "trayResume"),
          quit: translate(lang, "trayQuit"),
          tooltipPaused: translate(lang, "trayPaused"),
        },
      });
    })();
  }, [demo, settings.intervalMs, settings.slowWhenHidden, settings.closeToTray, theme, paused, lang]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleTheme = useCallback(() => {
    setSettings((prev) => ({ ...prev, theme: theme === "dark" ? "light" : "dark" }));
  }, [theme]);

  const setPaused = useCallback((next: boolean) => setPausedState(next), []);
  const requestKill = useCallback((proc: ProcessInfo) => setConfirm(proc), []);
  const cancelKill = useCallback(() => setConfirm(null), []);
  const confirmKill = useCallback(() => {
    const proc = confirm;
    setConfirm(null);
    if (!proc) return;
    if (demo) {
      killed.current.add(proc.pid);
      setSnap(demoSnapshot(tick.current, killed.current));
      setToast(translate(lang, "killOk"));
      return;
    }
    void (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("kill_process", { pid: proc.pid });
        setToast(translate(lang, "killOk"));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setToast(message || translate(lang, "killFail"));
      }
    })();
  }, [confirm, demo, lang]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  const value = useMemo<DeskContext>(
    () => ({
      page,
      setPage,
      snap,
      history,
      settings,
      updateSettings,
      theme,
      lang,
      t,
      accents,
      motion,
      paused,
      setPaused,
      toggleTheme,
      requestKill,
      confirm,
      cancelKill,
      confirmKill,
      toast,
      shot: query.shot,
      loading: !snap.demo && snap.timestampMs === 0,
    }),
    [
      page,
      snap,
      history,
      settings,
      updateSettings,
      theme,
      lang,
      t,
      accents,
      motion,
      paused,
      setPaused,
      toggleTheme,
      requestKill,
      confirm,
      cancelKill,
      confirmKill,
      toast,
      query.shot,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDesk() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDesk must be used inside DeskProvider");
  return ctx;
}

function emptyClient(): Snapshot {
  return {
    timestampMs: 0,
    demo: false,
    paused: false,
    cpu: { usage: 0, frequencyMhz: 0, brand: "", physicalCores: 0, logicalCores: 0, cores: [] },
    memory: { total: 0, used: 0, available: 0, swapTotal: 0, swapUsed: 0 },
    gpus: [],
    disks: [],
    network: { interfaceName: "", downBps: 0, upBps: 0, totalDown: 0, totalUp: 0, interfaces: [] },
    battery: null,
    temperatures: [],
    system: { hostname: "", os: "", kernel: "", arch: "", cpuBrand: "", uptimeSecs: 0 },
    processes: [],
  };
}
