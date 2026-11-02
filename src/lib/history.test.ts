import { describe, expect, it } from "vitest";
import { demoSnapshot } from "./demo";
import { appendSample, sampleFrom, windowSeries } from "./history";

describe("history", () => {
  it("appends and drops points outside the retention window", () => {
    const first = demoSnapshot(10);
    const second = { ...demoSnapshot(11), timestampMs: first.timestampMs + 1000 };
    const old = { ...demoSnapshot(1), timestampMs: second.timestampMs - 6 * 60 * 1000 };
    const history = appendSample(appendSample([sampleFrom(old)], first), second);
    expect(history.some((point) => point.t === old.timestampMs)).toBe(false);
    expect(history.at(-1)?.cpu).toBeCloseTo(second.cpu.usage);
  });

  it("replaces a sample with the same timestamp", () => {
    const snap = demoSnapshot(4);
    const updated = { ...snap, cpu: { ...snap.cpu, usage: 12 } };
    const history = appendSample([sampleFrom(snap)], updated);
    expect(history).toHaveLength(1);
    expect(history[0].cpu).toBe(12);
  });

  it("slices a time window from the newest sample", () => {
    let history = [] as ReturnType<typeof appendSample>;
    for (let tick = 0; tick < 10; tick += 1) {
      const snap = demoSnapshot(tick);
      snap.timestampMs = tick * 1000;
      history = appendSample(history, snap, 60_000);
    }
    const series = windowSeries(history, 4_000, (point) => point.cpu);
    expect(series.x).toHaveLength(5);
    expect(series.y[0]).toBeCloseTo(demoSnapshot(5).cpu.usage);
  });
});
