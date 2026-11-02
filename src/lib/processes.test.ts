import { describe, expect, it } from "vitest";
import type { ProcessInfo } from "../types";
import { filterProcesses, sortProcesses, topProcesses } from "./processes";

const rows: ProcessInfo[] = [
  { pid: 2, name: "chrome", user: "aurora", cpu: 4, memory: 100 },
  { pid: 1, name: "Cursor", user: "aurora", cpu: 9, memory: 50 },
  { pid: 3, name: "Discord", user: "guest", cpu: 1, memory: 20 },
];

describe("processes", () => {
  it("filters by name, pid, and user", () => {
    expect(filterProcesses(rows, "cur").map((row) => row.pid)).toEqual([1]);
    expect(filterProcesses(rows, "3").map((row) => row.name)).toEqual(["Discord"]);
    expect(filterProcesses(rows, "guest")).toHaveLength(1);
    expect(filterProcesses(rows, "  ")).toHaveLength(3);
  });

  it("sorts stably and returns the busiest processes", () => {
    expect(sortProcesses(rows, "cpu", "desc").map((row) => row.name)).toEqual(["Cursor", "chrome", "Discord"]);
    expect(sortProcesses(rows, "name", "asc").map((row) => row.name)[0]).toBe("chrome");
    expect(sortProcesses(rows, "memory", "asc").map((row) => row.pid)).toEqual([3, 1, 2]);
    expect(topProcesses(rows, 2).map((row) => row.name)).toEqual(["Cursor", "chrome"]);
  });
});
