import { describe, expect, it } from "vitest";
import { formatBytes, formatDuration, formatPercent, formatRate, formatUptime, percentOf, sanitizeInterval } from "./format";

describe("format", () => {
  it("formats bytes and rates on 1024 boundaries", () => {
    expect(formatBytes(512)).toEqual({ value: "512", unit: "B" });
    expect(formatBytes(1536)).toEqual({ value: "1.50", unit: "KB" });
    expect(formatBytes(12 * 1024 * 1024)).toEqual({ value: "12.0", unit: "MB" });
    expect(formatRate(1024 * 1024)).toEqual({ value: "1.00", unit: "MB/s" });
    expect(formatBytes(Number.NaN)).toEqual({ value: "0", unit: "B" });
  });

  it("formats percents, uptime, and duration", () => {
    expect(formatPercent(42.25)).toBe("42.3");
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatUptime(86_400 + 3_600 * 2 + 60, "en")).toBe("1d 2h 1m");
    expect(formatUptime(120, "zh")).toBe("2 分");
    expect(formatUptime(3_700, "zh")).toBe("1 小时 1 分");
    expect(formatDuration(90 * 60, "en")).toBe("1h 30m");
    expect(formatDuration(null, "en")).toBeNull();
  });

  it("guards empty totals and unknown intervals", () => {
    expect(percentOf(5, 0)).toBe(0);
    expect(percentOf(25, 100)).toBe(25);
    expect(percentOf(150, 100)).toBe(100);
    expect(sanitizeInterval(750)).toBe(1000);
    expect(sanitizeInterval(500)).toBe(500);
  });
});
