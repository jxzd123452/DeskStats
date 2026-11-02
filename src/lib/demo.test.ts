import { describe, expect, it } from "vitest";
import { DEMO_PROCESS_COUNT, cpuWave, demoSnapshot } from "./demo";

describe("demo snapshot", () => {
  it("is deterministic and stays inside display bounds", () => {
    const a = demoSnapshot(72);
    const b = demoSnapshot(72);
    expect(a.cpu.usage).toBe(b.cpu.usage);
    expect(a.cpu.cores).toHaveLength(8);
    expect(a.cpu.usage).toBeGreaterThan(5);
    expect(a.cpu.usage).toBeLessThan(95);
    expect(a.memory.used).toBeLessThanOrEqual(a.memory.total);
    expect(a.gpus[0].temperatureC).toBeGreaterThan(0);
    expect(a.disks).toHaveLength(2);
    expect(a.battery?.state).toBe("charging");
    expect(a.temperatures.length).toBeGreaterThanOrEqual(3);
    expect(a.processes).toHaveLength(DEMO_PROCESS_COUNT);
    const avg = a.cpu.cores.reduce((sum, core) => sum + core.usage, 0) / a.cpu.cores.length;
    expect(Math.abs(avg - a.cpu.usage)).toBeLessThan(1.5);
    const cpus = a.processes.map((proc) => proc.cpu);
    expect([...cpus].sort((x, y) => y - x)).toEqual(cpus);
  });

  it("drops killed processes and varies the cpu wave", () => {
    const snap = demoSnapshot(10, new Set([4412]));
    expect(snap.processes.some((proc) => proc.pid === 4412)).toBe(false);
    expect(cpuWave(10)).not.toBe(cpuWave(40));
  });
});
