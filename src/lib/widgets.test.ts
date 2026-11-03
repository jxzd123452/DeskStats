import { describe, expect, it } from "vitest";
import {
  closeWidget,
  defaultWidgetState,
  detectRole,
  loadWidgetState,
  serializeWidgetState,
  toggleWidget,
  unlockWidgets,
  updateGeometry,
  updateWidget,
  WIDGET_KINDS,
} from "./widgets";

describe("widget state persistence", () => {
  it("starts with every widget closed at a stable default size", () => {
    const state = defaultWidgetState();
    expect(state.widgets.map((item) => item.kind)).toEqual([...WIDGET_KINDS]);
    expect(state.widgets.every((item) => !item.open && !item.clickThrough && item.mode === "top")).toBe(true);
    expect(state.widgets.find((item) => item.kind === "cpu")).toMatchObject({ width: 250, height: 168, opacity: 0.86 });
  });

  it("round-trips and drops unknown or broken records", () => {
    const opened = toggleWidget(defaultWidgetState(), "network");
    const moved = updateWidget(opened, "network", { x: 400, y: 80, opacity: 0.5, mode: "desktop", clickThrough: true });
    const restored = loadWidgetState(serializeWidgetState(moved));
    expect(restored.widgets.find((item) => item.kind === "network")).toMatchObject({
      open: true,
      x: 400,
      y: 80,
      opacity: 0.5,
      mode: "desktop",
      clickThrough: true,
    });
    expect(loadWidgetState("not json").widgets.every((item) => !item.open)).toBe(true);
    const partial = loadWidgetState(
      JSON.stringify({
        widgets: [
          { kind: "gpu", open: true, width: 12, height: 9000, opacity: 4, mode: "sideways", x: Number.NaN },
          { kind: "not-a-widget", open: true },
        ],
      }),
    );
    expect(partial.widgets.find((item) => item.kind === "gpu")).toMatchObject({
      open: true,
      width: 180,
      height: 520,
      opacity: 1,
      mode: "top",
      x: 572,
    });
    expect(partial.widgets.find((item) => item.kind === "cpu")?.open).toBe(false);
  });

  it("remembers geometry when a widget is closed and reopened", () => {
    const placed = updateWidget(toggleWidget(defaultWidgetState(), "disks"), "disks", {
      x: 640,
      y: 240,
      width: 300,
      height: 200,
    });
    const closed = closeWidget(placed, "disks");
    expect(closed.widgets.find((item) => item.kind === "disks")).toMatchObject({
      open: false,
      x: 640,
      y: 240,
      width: 300,
      height: 200,
    });
    const reopened = loadWidgetState(serializeWidgetState(toggleWidget(closed, "disks")));
    expect(reopened.widgets.find((item) => item.kind === "disks")?.open).toBe(true);
    expect(reopened.widgets.find((item) => item.kind === "disks")?.x).toBe(640);
  });

  it("ignores geometry for a closed widget and unlocks click-through", () => {
    const locked = updateWidget(toggleWidget(defaultWidgetState(), "cpu"), "cpu", { clickThrough: true, x: 20, y: 30 });
    const nudged = updateGeometry(closeWidget(locked, "cpu"), { kind: "cpu", x: 800, y: 800, width: 400, height: 300 });
    expect(nudged.widgets.find((item) => item.kind === "cpu")?.x).toBe(20);
    const moved = updateGeometry(locked, { kind: "cpu", x: 88.4, y: 12.2, width: 222.2, height: 140.4 });
    expect(moved.widgets.find((item) => item.kind === "cpu")).toMatchObject({ x: 88, y: 12, width: 222, height: 140 });
    const unlocked = unlockWidgets(moved);
    expect(unlocked.widgets.every((item) => !item.clickThrough)).toBe(true);
    expect(unlockWidgets(unlocked)).toBe(unlocked);
  });

  it("detects the main shell, a widget window, and the desktop scene", () => {
    expect(detectRole("")).toEqual({ type: "main" });
    expect(detectRole("?page=settings&panel=alerts")).toEqual({ type: "main" });
    expect(detectRole("?page=widgets")).toEqual({ type: "scene" });
    expect(detectRole("?widget=sensors")).toEqual({ type: "widget", kind: "sensors" });
    expect(detectRole("?widget=nope")).toEqual({ type: "main" });
    (globalThis as { __DESKSTATS_WIDGET__?: string }).__DESKSTATS_WIDGET__ = "memory";
    expect(detectRole("")).toEqual({ type: "widget", kind: "memory" });
    delete (globalThis as { __DESKSTATS_WIDGET__?: string }).__DESKSTATS_WIDGET__;
  });
});
