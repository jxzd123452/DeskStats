import { describe, expect, it } from "vitest";
import { demoSnapshot } from "./demo";
import {
  clearPending,
  defaultRules,
  directionFor,
  emptyEngine,
  loadAlertStore,
  readingsFromSnapshot,
  stepAlerts,
  type AlertRule,
  type Readings,
} from "./alerts";

function cpuRule(patch: Partial<AlertRule> = {}): AlertRule {
  return {
    id: "cpu",
    metric: "cpu",
    enabled: true,
    threshold: 90,
    durationMs: 30_000,
    cooldownMs: 300_000,
    hysteresis: 5,
    ...patch,
  };
}

function readings(cpu: number | null, extra: Partial<Readings> = {}): Readings {
  return { cpu, memory: null, gpu: null, temperature: null, diskFree: null, battery: null, ...extra };
}

function fold(rule: AlertRule, samples: Array<[number, number | null]>, gap = 45_000) {
  let state = emptyEngine();
  const fired: number[] = [];
  for (const [now, value] of samples) {
    const result = stepAlerts([rule], readings(value), state, now, gap);
    state = result.state;
    fired.push(...result.fired.map((event) => event.at));
  }
  return { state, fired };
}

describe("alert rule engine", () => {
  it("ships a CPU rule at 90% for 30s", () => {
    const cpu = defaultRules().find((rule) => rule.metric === "cpu");
    expect(cpu).toMatchObject({ enabled: true, threshold: 90, durationMs: 30_000, cooldownMs: 300_000, hysteresis: 5 });
    expect(directionFor("cpu")).toBe("above");
    expect(directionFor("battery")).toBe("below");
    expect(directionFor("diskFree")).toBe("below");
  });

  it("does not fire before the hold elapses, then fires once", () => {
    const early = fold(cpuRule(), [[0, 95], [29_999, 96]]);
    expect(early.fired).toEqual([]);
    expect(early.state.rules.cpu.phase).toBe("pending");
    const done = fold(cpuRule(), [[0, 95], [30_000, 96]]);
    expect(done.fired).toEqual([30_000]);
    expect(done.state.rules.cpu.phase).toBe("firing");
  });

  it("waits out the cooldown before reminding, even if the reading stays high", () => {
    const samples: Array<[number, number | null]> = [
      [0, 95],
      [30_000, 97],
    ];
    for (let t = 60_000; t <= 330_000; t += 30_000) samples.push([t, 99]);
    const result = fold(cpuRule(), samples);
    expect(result.fired).toEqual([30_000, 330_000]);
  });

  it("keeps the hold timer through a dip inside the hysteresis band", () => {
    const result = fold(cpuRule(), [
      [0, 91],
      [20_000, 86],
      [30_000, 86],
    ]);
    expect(result.fired).toEqual([30_000]);
  });

  it("resets the hold when the reading recovers past the hysteresis band", () => {
    const result = fold(cpuRule(), [
      [0, 93],
      [20_000, 84],
      [30_000, 96],
      [59_999, 96],
      [60_000, 96],
    ]);
    expect(result.fired).toEqual([60_000]);
    expect(result.state.rules.cpu.phase).toBe("firing");
  });

  it("requires a fresh hold and the cooldown after an incident clears", () => {
    const rule = cpuRule({ cooldownMs: 50_000, hysteresis: 5 });
    const result = fold(rule, [
      [0, 95],
      [30_000, 95],
      [31_000, 80],
      [32_000, 96],
      [62_000, 96],
      [82_000, 96],
    ]);
    expect(result.fired).toEqual([30_000, 82_000]);
  });

  it("does not count a sampling gap or a missing reading as time in breach", () => {
    const gap = fold(cpuRule(), [
      [0, 95],
      [20_000, 95],
      [80_000, 95],
      [110_000, 95],
    ]);
    expect(gap.fired).toEqual([110_000]);

    const missing = fold(cpuRule(), [
      [0, 95],
      [10_000, null],
      [40_000, 95],
    ]);
    expect(missing.fired).toEqual([40_000]);
  });

  it("ignores a disabled rule and a null reading on a quiet machine", () => {
    const disabled = fold(cpuRule({ enabled: false }), [[0, 100], [60_000, 100]]);
    expect(disabled.fired).toEqual([]);
    const quiet = fold(cpuRule(), [[0, null], [60_000, null]]);
    expect(quiet.fired).toEqual([]);
  });

  it("uses the below-threshold direction for battery, with hysteresis and cooldown", () => {
    const rule: AlertRule = {
      id: "battery",
      metric: "battery",
      enabled: true,
      threshold: 20,
      durationMs: 30_000,
      cooldownMs: 60_000,
      hysteresis: 5,
    };
    let state = emptyEngine();
    const fired: number[] = [];
    const samples: Array<[number, number]> = [
      [0, 21],
      [1_000, 20],
      [31_000, 18],
      [40_000, 24],
      [50_000, 26],
      [51_000, 15],
      [81_000, 15],
      [111_000, 14],
    ];
    for (const [now, battery] of samples) {
      const result = stepAlerts([rule], readings(null, { battery }), state, now);
      state = result.state;
      fired.push(...result.fired.map((event) => event.at));
    }
    expect(fired).toEqual([31_000, 111_000]);
  });

  it("evaluates rules independently", () => {
    const rules = [cpuRule(), cpuRule({ id: "memory", metric: "memory", threshold: 90, durationMs: 10_000 })];
    const result = stepAlerts(rules, readings(96, { memory: 50 }), emptyEngine(), 0);
    const later = stepAlerts(rules, readings(96, { memory: 50 }), result.state, 30_000);
    expect(later.fired.map((event) => event.ruleId)).toEqual(["cpu"]);
  });

  it("drops a pending hold when sampling is paused", () => {
    const pending = fold(cpuRule(), [[0, 99], [10_000, 99]]);
    const cleared = clearPending(pending.state);
    expect(cleared.rules.cpu.phase).toBe("clear");
    const resumed = stepAlerts([cpuRule()], readings(99), cleared, 20_000);
    expect(resumed.fired).toEqual([]);
    expect(resumed.state.rules.cpu.phase).toBe("pending");
  });
});

describe("alert store persistence", () => {
  it("falls back to defaults and clamps stored rules", () => {
    expect(loadAlertStore(null).rules).toHaveLength(6);
    expect(loadAlertStore("{")).toEqual(loadAlertStore(null));
    const loaded = loadAlertStore(
      JSON.stringify({
        rules: [{ id: "cpu", metric: "cpu", enabled: false, threshold: 400, durationMs: 5, cooldownMs: 10, hysteresis: -2 }],
        history: [{ id: "x", ruleId: "cpu", metric: "cpu", value: 91, threshold: 90, at: 10 }, { metric: "nope" }],
        runtime: { lastStepAt: 10, rules: { cpu: { phase: "firing", since: 4, lastFiredAt: 8 } } },
      }),
    );
    expect(loaded.rules.find((rule) => rule.id === "cpu")).toMatchObject({
      enabled: false,
      threshold: 100,
      durationMs: 1_000,
      hysteresis: 0,
    });
    expect(loaded.history).toHaveLength(1);
    expect(loaded.runtime.rules.cpu.phase).toBe("firing");
    expect(loaded.rules.map((rule) => rule.id)).toEqual(defaultRules().map((rule) => rule.id));
  });

  it("reads alert inputs from a snapshot", () => {
    const snap = demoSnapshot(10);
    const values = readingsFromSnapshot(snap);
    expect(values.cpu).toBeCloseTo(snap.cpu.usage);
    expect(values.memory).toBeGreaterThan(40);
    expect(values.gpu).toBeCloseTo(snap.gpus[0].usage ?? 0);
    expect(values.temperature).toBeGreaterThan(40);
    expect(values.diskFree).toBeGreaterThan(0);
    expect(values.battery).toBe(76);
    expect(readingsFromSnapshot({ ...snap, battery: null, temperatures: [], gpus: [], disks: [] }).diskFree).toBeNull();
  });
});
