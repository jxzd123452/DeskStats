import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, Card, Kicker, Qty } from "../components/ui";
import { filterProcesses, sortProcesses, type SortDir, type SortKey } from "../lib/processes";
import { metricColor } from "../theme";
import { useDesk } from "../state";

export function ProcessesPage() {
  const { snap, accents, t, requestKill } = useDesk();
  const [query, setQuery] = useState("");
  const [key, setKey] = useState<SortKey>("cpu");
  const [dir, setDir] = useState<SortDir>("desc");
  const rows = useMemo(
    () => sortProcesses(filterProcesses(snap.processes, query), key, dir),
    [snap.processes, query, key, dir],
  );

  function toggle(next: SortKey) {
    if (next === key) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setKey(next);
      setDir(next === "name" || next === "user" ? "asc" : "desc");
    }
  }

  return (
    <div className="process-page">
      <div className="toolbar">
        <label className="search">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
          />
        </label>
        <span className="muted">{t("processesCount", { n: rows.length })}</span>
      </div>
      <Card accent={accents.cpu}>
        <Kicker>{t("nav.processes")}</Kicker>
        <div style={{ overflow: "auto", minHeight: 0, flex: 1 }}>
          <table className="table">
            <thead>
              <tr>
                <th><SortButton label={t("name")} active={key === "name"} dir={dir} onClick={() => toggle("name")} /></th>
                <th className="num"><SortButton label={t("pid")} active={key === "pid"} dir={dir} onClick={() => toggle("pid")} /></th>
                <th><SortButton label={t("user")} active={key === "user"} dir={dir} onClick={() => toggle("user")} /></th>
                <th className="num"><SortButton label={t("cpuPercent")} active={key === "cpu"} dir={dir} onClick={() => toggle("cpu")} /></th>
                <th className="num"><SortButton label={t("memoryCol")} active={key === "memory"} dir={dir} onClick={() => toggle("memory")} /></th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((proc) => (
                <tr key={proc.pid}>
                  <td>
                    <span style={{ display: "inline-flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                      <Avatar name={proc.name} />
                      <span className="truncate">{proc.name}</span>
                    </span>
                  </td>
                  <td className="num">{proc.pid}</td>
                  <td className="muted">{proc.user}</td>
                  <td className="num" style={{ color: metricColor(accents.cpu, proc.cpu, accents) }}>{proc.cpu.toFixed(1)}%</td>
                  <td className="num"><Qty bytes={proc.memory} /></td>
                  <td style={{ textAlign: "right" }}>
                    <button className="ghost danger" onClick={() => requestKill(proc)}>{t("end")}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <div className="empty"><strong>—</strong><div>{t("noProcesses")}</div></div> : null}
        </div>
      </Card>
    </div>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button className="sort" onClick={onClick} aria-pressed={active}>
      {label}
      {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );
}
