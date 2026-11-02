import type { ProcessInfo } from "../types";

export type SortKey = "name" | "pid" | "cpu" | "memory" | "user";
export type SortDir = "asc" | "desc";

export function filterProcesses(list: ProcessInfo[], query: string): ProcessInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (proc) =>
      proc.name.toLowerCase().includes(q) ||
      String(proc.pid).includes(q) ||
      proc.user.toLowerCase().includes(q),
  );
}

export function sortProcesses(list: ProcessInfo[], key: SortKey, dir: SortDir): ProcessInfo[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    let cmp = 0;
    if (key === "name") cmp = a.name.localeCompare(b.name);
    else if (key === "user") cmp = a.user.localeCompare(b.user);
    else if (key === "pid") cmp = a.pid - b.pid;
    else if (key === "memory") cmp = a.memory - b.memory;
    else cmp = a.cpu - b.cpu;
    if (cmp === 0) cmp = a.pid - b.pid;
    return cmp * sign;
  });
}

export function topProcesses(list: ProcessInfo[], count = 8): ProcessInfo[] {
  return sortProcesses(list, "cpu", "desc").slice(0, count);
}
