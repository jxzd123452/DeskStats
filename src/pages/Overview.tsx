import type { CSSProperties } from "react";
import { TimeChart } from "../components/Chart";
import { AnimatedPercent, Avatar, BigStat, Card, HeatGrid, Kicker, Meter, Qty, Ring } from "../components/ui";
import { formatDuration, formatGhz, formatRate, formatUptime, percentOf } from "../lib/format";
import { windowSeries } from "../lib/history";
import { topProcesses } from "../lib/processes";
import { pickCpuTemp, pickGpuTemp } from "../lib/sensors";
import { metricColor } from "../theme";
import { useDesk } from "../state";
import type { MessageKey } from "../i18n";

export function Overview() {
  const { snap, history, accents, t, lang, motion, setPage, shot } = useDesk();
  const ready = snap.demo || snap.timestampMs > 0;
  const cpuColor = metricColor(accents.cpu, snap.cpu.usage, accents);
  const memPct = percentOf(snap.memory.used, snap.memory.total);
  const memColor = metricColor(accents.memory, memPct, accents);
  const gpu = snap.gpus[0];
  const gpuPct = gpu?.usage ?? 0;
  const gpuColor = metricColor(accents.gpu, gpuPct, accents);
  const cpuTemp = pickCpuTemp(snap.temperatures);
  const gpuTemp = pickGpuTemp(snap.temperatures, gpu?.temperatureC);
  const cpuSeries = windowSeries(history, 60_000, (sample) => sample.cpu);
  const netDown = windowSeries(history, 60_000, (sample) => sample.down);
  const netUp = windowSeries(history, 60_000, (sample) => sample.up);
  const ghz = formatGhz(snap.cpu.frequencyMhz);
  const battery = snap.battery;
  const remain = formatDuration(battery?.secsRemaining ?? null, lang);
  const down = formatRate(snap.network.downBps);
  const up = formatRate(snap.network.upBps);

  return (
    <div className="page">
      <div className="bento">
        <Card accent={accents.cpu} className="span-6 row-2 cpu">
          <div className="card-head">
            <div style={{ minWidth: 0 }}>
              <Kicker>{t("section.cpu")}</Kicker>
              <div className="sub truncate">{snap.cpu.brand || "—"}</div>
            </div>
            <div className="muted num" style={{ fontSize: 12 }}>
              {snap.cpu.logicalCores || "—"} {t("cores")}
              {ghz ? ` · ${ghz} GHz` : ""}
            </div>
          </div>
          <div className="hero-row">
            {ready ? (
              <BigStat value="" unit="%">
                <AnimatedPercent value={snap.cpu.usage} enabled={motion && !shot} />
              </BigStat>
            ) : (
              <BigStat value="—" unit="%" />
            )}
            <span className="temp-pill num" style={{ "--pill": accents.temp } as CSSProperties}>
              {cpuTemp == null ? "—" : `${cpuTemp.toFixed(0)}°`}
            </span>
          </div>
          <TimeChart
            x={cpuSeries.x}
            series={[{ label: "CPU", color: cpuColor, data: cpuSeries.y }]}
            fill
            yMax={100}
            grid="var(--grid-line)"
            interactive={!shot}
          />
          <HeatGrid cells={snap.cpu.cores} accent={cpuColor} />
        </Card>

        <Card accent={accents.memory} className="span-3 mem">
          <Kicker>{t("section.memory")}</Kicker>
          <div className="split">
            <Ring value={memPct} color={memColor} size={84}>
              <span className="num">{ready ? `${memPct.toFixed(0)}%` : "—"}</span>
            </Ring>
            <div className="stat-stack">
              <div className="stat-line">
                <span className="muted">{t("used")}</span>
                <Qty bytes={snap.memory.used} />
              </div>
              <div className="stat-line">
                <span className="muted">{t("total")}</span>
                <Qty bytes={snap.memory.total} />
              </div>
              <div className="stat-line">
                <span className="muted">{t("swap")}</span>
                <span className="num">
                  {snap.memory.swapTotal
                    ? `${percentOf(snap.memory.swapUsed, snap.memory.swapTotal).toFixed(0)}%`
                    : t("swapNone")}
                </span>
              </div>
              {snap.memory.swapTotal > 0 ? (
                <Meter value={percentOf(snap.memory.swapUsed, snap.memory.swapTotal)} color={accents.memory} />
              ) : null}
            </div>
          </div>
        </Card>

        <Card accent={accents.gpu} className="span-3 gpu">
          <div className="card-head">
            <Kicker>{t("section.gpu")}</Kicker>
            <span className="temp-pill num" style={{ "--pill": accents.temp } as CSSProperties}>
              {gpuTemp == null ? "—" : `${gpuTemp.toFixed(0)}°`}
            </span>
          </div>
          {gpu ? (
            <div className="split">
              <Ring value={gpuPct} color={gpuColor} size={84}>
                <span className="num">{gpu.usage == null ? "—" : `${gpuPct.toFixed(0)}%`}</span>
              </Ring>
              <div className="stat-stack">
                <div className="sub truncate" title={gpu.name}>{gpu.name}</div>
                <div className="stat-line">
                  <span className="muted">{t("vram")}</span>
                  {gpu.memoryUsed != null ? <Qty bytes={gpu.memoryUsed} /> : <span>—</span>}
                </div>
                {gpu.memoryTotal ? (
                  <Meter value={percentOf(gpu.memoryUsed ?? 0, gpu.memoryTotal)} color={gpuColor} />
                ) : null}
                <div className="muted num" style={{ fontSize: 11 }}>
                  {gpu.powerWatts != null ? `${gpu.powerWatts.toFixed(0)} W` : "—"}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty">
              <strong>—</strong>
              <div>{t("noGpu")}</div>
            </div>
          )}
        </Card>

        <Card accent={accents.down} className="span-6 net">
          <div className="card-head">
            <Kicker>{t("section.network")}</Kicker>
            <span className="sub truncate">{snap.network.interfaceName || t("noNetwork")}</span>
          </div>
          <div className="rate-pair">
            <div>
              <div className="legend"><i style={{ background: accents.down }} />{t("down")}</div>
              <div className="big sm" style={{ color: accents.down }}>
                <span className="num">{down.value}</span>
                <span className="unit">{down.unit}</span>
              </div>
            </div>
            <div>
              <div className="legend"><i style={{ background: accents.up }} />{t("up")}</div>
              <div className="big sm" style={{ color: accents.up }}>
                <span className="num">{up.value}</span>
                <span className="unit">{up.unit}</span>
              </div>
            </div>
          </div>
          <TimeChart
            x={netDown.x}
            series={[
              { label: t("down"), color: accents.down, data: netDown.y, rate: true },
              { label: t("up"), color: accents.up, data: netUp.y, fill: false, rate: true },
            ]}
            fill
            grid="var(--grid-line)"
            interactive={!shot}
          />
          <div className="rates">
            <span>↓ <Qty bytes={snap.network.totalDown} /></span>
            <span>↑ <Qty bytes={snap.network.totalUp} /></span>
          </div>
        </Card>

        <Card accent={accents.disk} className="span-4 disk">
          <Kicker>{t("section.disk")}</Kicker>
          <div className="disk-list">
            {snap.disks.length === 0 ? (
              <div className="empty"><strong>—</strong><div>{t("noDisks")}</div></div>
            ) : null}
            {snap.disks.map((disk) => {
              const pct = percentOf(disk.used, disk.total);
              return (
                <div key={disk.mount} className="disk-block">
                  <div className="disk-top">
                    <span className="truncate">{disk.mount} · {disk.name}</span>
                    <span className="num">{pct.toFixed(0)}%</span>
                  </div>
                  <Meter value={pct} color={metricColor(accents.disk, pct, accents)} />
                  <div className="rates">
                    <span><Qty bytes={disk.used} /> / <Qty bytes={disk.total} /></span>
                    <span>↓ <Qty bytes={disk.readBps} rate /> ↑ <Qty bytes={disk.writeBps} rate /></span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card accent={accents.temp} className="span-4 temp">
          <Kicker>{t("section.sensors")}</Kicker>
          {snap.temperatures.length === 0 ? (
            <div className="empty">
              <strong>{t("noSensors")}</strong>
              <div>{t("noSensorsHint")}</div>
            </div>
          ) : (
            <div className="sensor-list">
              {snap.temperatures.slice(0, 4).map((temp) => (
                <div key={temp.label} className="sensor-row">
                  <span className="truncate">{temp.label}</span>
                  <Meter
                    value={Math.min(100, (temp.celsius / (temp.critical ?? 100)) * 100)}
                    color={metricColor(accents.temp, temp.celsius >= 85 ? 92 : 20, accents)}
                  />
                  <span className="num" style={{ textAlign: "right" }}>{temp.celsius.toFixed(0)}°</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card accent={accents.battery} className="span-4 sys">
          {battery ? (
            <>
              <div className="card-head">
                <Kicker>{t("section.battery")}</Kicker>
                <span className="num">{battery.percent.toFixed(0)}%</span>
              </div>
              <Meter value={battery.percent} color={accents.battery} />
              <div className="muted">
                {labelState(battery.state, t)}
                {remain ? ` · ${remain}` : ""}
              </div>
            </>
          ) : (
            <Kicker>{t("section.system")}</Kicker>
          )}
          <div className="sys-meta">
            <div className="sys-name truncate">{snap.system.hostname || "—"}</div>
            <div className="truncate">{snap.system.os || "—"}</div>
            <div className="muted truncate">
              {t("uptime")} {formatUptime(snap.system.uptimeSecs, lang)}
            </div>
            <div className="muted truncate">{snap.system.cpuBrand || snap.cpu.brand || "—"}</div>
          </div>
        </Card>

        <Card accent={accents.up} className="span-12 procs">
          <div className="card-head">
            <Kicker>{t("section.processes")}</Kicker>
            <button className="linkish" onClick={() => setPage("processes")}>{t("viewAll")}</button>
          </div>
          <div className="proc-list">
            {topProcesses(snap.processes, 8).map((proc) => (
              <button
                key={proc.pid}
                className="mini-proc"
                onClick={() => setPage("processes")}
                style={{ border: 0, background: "transparent", textAlign: "left", padding: 0 }}
              >
                <Avatar name={proc.name} />
                <span className="truncate">{proc.name}</span>
                <span className="num" style={{ textAlign: "right", color: metricColor(accents.cpu, proc.cpu, accents) }}>
                  {proc.cpu.toFixed(1)}%
                </span>
                <span className="num" style={{ textAlign: "right" }}><Qty bytes={proc.memory} /></span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function labelState(
  state: string,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
) {
  if (state === "charging" || state === "discharging" || state === "full" || state === "empty" || state === "unknown") {
    return t(state);
  }
  return t("unknown");
}
