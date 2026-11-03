import { isTauri } from "./settings";
import type { WidgetPlacement, WidgetState } from "./widgets";

export async function syncWidgetWindows(widgets: WidgetPlacement[]): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("sync_widgets", { widgets });
}

export async function beginWidgetResize(): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("begin_widget_resize");
}

/** Browser demo only: a real OS window is created by the Tauri shell. */
export function mirrorBrowserPopups(previous: WidgetState, next: WidgetState) {
  if (isTauri() || typeof window.open !== "function") return;
  for (const widget of next.widgets) {
    const before = previous.widgets.find((item) => item.kind === widget.kind);
    if (!widget.open || before?.open) continue;
    const url = `${location.origin}${location.pathname}?widget=${widget.kind}`;
    window.open(
      url,
      `deskstats-${widget.kind}`,
      `popup=yes,width=${widget.width},height=${widget.height},left=${widget.x},top=${widget.y}`,
    );
  }
}
