import { describe, expect, it } from "vitest";
import { pickCpuTemp, pickGpuTemp, tempLevel, usageLevel } from "./sensors";

describe("sensors", () => {
  it("picks cpu and gpu temperatures with fallbacks", () => {
    const temps = [
      { label: "NVMe", celsius: 41, critical: 80 },
      { label: "CPU Package", celsius: 62, critical: 95 },
      { label: "GPU Hotspot", celsius: 70, critical: null },
    ];
    expect(pickCpuTemp(temps)).toBe(62);
    expect(pickCpuTemp([{ label: "Board", celsius: 40, critical: null }])).toBeNull();
    expect(pickGpuTemp(temps, 64)).toBe(64);
    expect(pickGpuTemp(temps, null)).toBe(70);
  });

  it("classifies usage and temperature", () => {
    expect(usageLevel(10)).toBe("ok");
    expect(usageLevel(75)).toBe("warn");
    expect(usageLevel(90)).toBe("crit");
    expect(tempLevel(84)).toBe("ok");
    expect(tempLevel(85)).toBe("warn");
    expect(tempLevel(95)).toBe("crit");
  });
});
