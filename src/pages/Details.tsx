import { useState, type ReactNode } from "react";
import { Spark, TimeChart } from "../components/Chart";
import { Card, Kicker, Meter, Qty } from "../components/ui";
import { formatGhz, percentOf } from "../lib/format";
import { coreSeries, windowSeries } from "../lib/history";
import { pickCpuTemp, pickGpuTemp } from "../lib/sensors";
import { metricColor } from "../theme";
import { useDesk } from "../state";

const WINDOWS = [
  { id: 60_000, key: "window60" as const },
  { id: 300_000, key: "window5m" as const },
];

export function CpuPage() {
  const desk = useDesk();
  const [windowMs, setWindowMs] = useState(60_000);
  const { snap, history, accents, t, shot } = desk;
  const series = windowSeries(history, windowMs, (sample) => sample.cpu);
  const color = metricColor(accents.cpu, snap.cpu.usage, accents);
  const temp = pickCpuTemp(snap.temperatures);
  const ghz = formatGhz(snap.cpu.frequencyMhz);
  return (
    <div className="detail">
      <Card accent={accents.cpu} className="detail-hero">
        <div className="card-head">
          <div>
            <Kicker>{t("section.cpu")}</Kicker>
            <div className="sub truncate">{snap.cpu.brand || "—"}</div>
          </div>
          <WindowToggle windowMs={windowMs} onChange={setWindowMs} />
        </div>
        <div className="hero-row">
          <div className="big">
            <span className="num">{snap.cpu.usage.toFixed(1)}</span>
            <span className="unit">%</span>
          </div>
        </div>
        <TimeChart x={series.x} series={[{ label: "CPU", color, data: series.y }]} height={168} yMax={100} grid="var(--grid-line)" interactive={!shot} />
      </Card>
      <div className="tiles">
        <Tile label={t("frequency")} value={ghz ? `${ghz} GHz` : "—"} accent={accents.cpu} />
        <Tile label={t("temperature")} value={temp == null ? "—" : `${temp.toFixed(1)}°`} accent={accents.temp} />
        <Tile label={t("physical")} value={String(snap.cpu.physicalCores || "—")} accent={accents.cpu} />
        <Tile label={t("logical")} value={String(snap.cpu.logicalCores || "—")} accent={accents.cpu} />
      </div>
      <Card accent={accents.cpu}>
        <Kicker>{t("perCore")}</Kicker>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>{t("utilization")}</th>
              <th>{t("frequency")}</th>
              <th style={{ width: "28%" }} />
            </tr>
          </thead>
          <tbody>
            {snap.cpu.cores.map((core) => (
              <tr key={core.id}>
                <td className="num">{core.id}</td>
                <td className="num">{core.usage.toFixed(1)}%</td>
                <td className="num">{formatGhz(core.frequencyMhz) ? `${formatGhz(core.frequencyMhz)} GHz` : "—"}</td>
                <td>
                  <Spark values={coreSeries(history, windowMs, core.id).y} color={color} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function MemoryPage() {
  const { snap, history, accents, t, shot } = useDesk();
  const [windowMs, setWindowMs] = useState(60_000);
  const series = windowSeries(history, windowMs, (sample) => sample.mem);
  const pct = percentOf(snap.memory.used, snap.memory.total);
  const color = metricColor(accents.memory, pct, accents);
  return (
    <div className="detail">
      <Card accent={accents.memory} className="detail-hero">
        <div className="card-head">
          <Kicker>{t("section.memory")}</Kicker>
          <WindowToggle windowMs={windowMs} onChange={setWindowMs} />
        </div>
        <div className="big">
          <span className="num">{pct.toFixed(1)}</span>
          <span className="unit">%</span>
        </div>
        <TimeChart x={series.x} series={[{ label: t("section.memory"), color, data: series.y }]} height={168} yMax={100} grid="var(--grid-line)" interactive={!shot} />
      </Card>
      <div className="tiles">
        <Tile label={t("used")} value={<Qty bytes={snap.memory.used} />} accent={accents.memory} />
        <Tile label={t("available")} value={<Qty bytes={snap.memory.available} />} accent={accents.memory} />
        <Tile label={t("total")} value={<Qty bytes={snap.memory.total} />} accent={accents.memory} />
        <Tile label={t("swap")} value={snap.memory.swapTotal ? <Qty bytes={snap.memory.swapUsed} /> : t("swapNone")} accent={accents.memory} />
      </div>
    </div>
  );
}

export function GpuPage() {
  const { snap, history, accents, t, shot } = useDesk();
  const [windowMs, setWindowMs] = useState(60_000);
  const gpu = snap.gpus[0];
  const series = windowSeries(history, windowMs, (sample) => sample.gpu);
  const color = metricColor(accents.gpu, gpu?.usage ?? 0, accents);
  const temp = pickGpuTemp(snap.temperatures, gpu?.temperatureC);
  return (
    <div className="detail">
      <Card accent={accents.gpu} className="detail-hero">
        <div className="card-head">
          <div style={{ minWidth: 0 }}>
            <Kicker>{t("section.gpu")}</Kicker>
            <div className="sub truncate">{gpu?.name || t("noGpu")}</div>
          </div>
          <WindowToggle windowMs={windowMs} onChange={setWindowMs} />
        </div>
        {gpu ? (
          <>
            <div className="big">
              <span className="num">{gpu.usage == null ? "—" : gpu.usage.toFixed(1)}</span>
              <span className="unit">%</span>
            </div>
            <TimeChart x={series.x} series={[{ label: "GPU", color, data: series.y }]} height={168} yMax={100} grid="var(--grid-line)" interactive={!shot} />
          </>
        ) : (
          <div className="empty">
            <strong>—</strong>
            <div>{t("noGpuHint")}</div>
          </div>
        )}
      </Card>
      <div className="tiles">
        <Tile label={t("vram")} value={gpu?.memoryUsed != null ? <Qty bytes={gpu.memoryUsed} /> : "—"} accent={accents.gpu} />
        <Tile label={t("total")} value={gpu?.memoryTotal != null ? <Qty bytes={gpu.memoryTotal} /> : "—"} accent={accents.gpu} />
        <Tile label={t("temperature")} value={temp == null ? "—" : `${temp.toFixed(0)}°`} accent={accents.temp} />
        <Tile label={t("power")} value={gpu?.powerWatts != null ? `${gpu.powerWatts.toFixed(0)} W` : "—"} accent={accents.gpu} />
      </div>
    </div>
  );
}

export function DiskPage() {
  const { snap, history, accents, t, shot } = useDesk();
  const [windowMs, setWindowMs] = useState(60_000);
  const read = windowSeries(history, windowMs, (sample) => sample.read);
  const write = windowSeries(history, windowMs, (sample) => sample.write);
  return (
    <div className="detail">
      <Card accent={accents.disk} className="detail-hero">
        <div className="card-head">
          <Kicker>{t("section.disk")}</Kicker>
          <WindowToggle windowMs={windowMs} onChange={setWindowMs} />
        </div>
        <div className="legend">
          <span><i style={{ background: accents.disk }} />{t("read")}</span>
          <span><i style={{ background: accents.up }} />{t("write")}</span>
        </div>
        <TimeChart
          x={read.x}
          series={[
            { label: t("read"), color: accents.disk, data: read.y, rate: true },
            { label: t("write"), color: accents.up, data: write.y, fill: false, rate: true },
          ]}
          height={168}
          grid="var(--grid-line)"
          interactive={!shot}
        />
      </Card>
      <Card accent={accents.disk}>
        <table className="table">
          <thead>
            <tr>
              <th>{t("mount")}</th>
              <th>{t("kind")}</th>
              <th className="num">{t("used")}</th>
              <th className="num">{t("capacity")}</th>
              <th style={{ width: "22%" }} />
            </tr>
          </thead>
          <tbody>
            {snap.disks.map((disk) => {
              const pct = percentOf(disk.used, disk.total);
              return (
                <tr key={disk.mount}>
                  <td>
                    <div className="truncate">{disk.mount}</div>
                    <div className="muted truncate">{disk.name}</div>
                  </td>
                  <td>{disk.kind}</td>
                  <td className="num"><Qty bytes={disk.used} /></td>
                  <td className="num"><Qty bytes={disk.total} /></td>
                  <td><Meter value={pct} color={metricColor(accents.disk, pct, accents)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {snap.disks.length === 0 ? <div className="empty"><strong>—</strong><div>{t("noDisks")}</div></div> : null}
      </Card>
    </div>
  );
}

export function NetworkPage() {
  const { snap, history, accents, t, shot } = useDesk();
  const [windowMs, setWindowMs] = useState(60_000);
  const down = windowSeries(history, windowMs, (sample) => sample.down);
  const up = windowSeries(history, windowMs, (sample) => sample.up);
  return (
    <div className="detail">
      <Card accent={accents.down} className="detail-hero">
        <div className="card-head">
          <div>
            <Kicker>{t("section.network")}</Kicker>
            <div className="sub">{snap.network.interfaceName || t("noNetwork")}</div>
          </div>
          <WindowToggle windowMs={windowMs} onChange={setWindowMs} />
        </div>
        <TimeChart
          x={down.x}
          series={[
            { label: t("down"), color: accents.down, data: down.y, rate: true },
            { label: t("up"), color: accents.up, data: up.y, fill: false, rate: true },
          ]}
          height={168}
          grid="var(--grid-line)"
          interactive={!shot}
        />
      </Card>
      <div className="tiles">
        <Tile label={t("down")} value={<Qty bytes={snap.network.downBps} rate />} accent={accents.down} />
        <Tile label={t("up")} value={<Qty bytes={snap.network.upBps} rate />} accent={accents.up} />
        <Tile label={t("totalDown")} value={<Qty bytes={snap.network.totalDown} />} accent={accents.down} />
        <Tile label={t("totalUp")} value={<Qty bytes={snap.network.totalUp} />} accent={accents.up} />
      </div>
      <Card accent={accents.down}>
        <table className="table">
          <thead>
            <tr>
              <th>{t("interface")}</th>
              <th className="num">{t("down")}</th>
              <th className="num">{t("up")}</th>
              <th className="num">{t("totalDown")}</th>
              <th className="num">{t("totalUp")}</th>
            </tr>
          </thead>
          <tbody>
            {snap.network.interfaces.map((nic) => (
              <tr key={nic.name}>
                <td>{nic.name}</td>
                <td className="num"><Qty bytes={nic.downBps} rate /></td>
                <td className="num"><Qty bytes={nic.upBps} rate /></td>
                <td className="num"><Qty bytes={nic.totalDown} /></td>
                <td className="num"><Qty bytes={nic.totalUp} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function WindowToggle({ windowMs, onChange }: { windowMs: number; onChange: (ms: number) => void }) {
  const { t } = useDesk();
  return (
    <div className="seg" role="group" aria-label={t("chartWindow")}>
      {WINDOWS.map((item) => (
        <button key={item.id} aria-pressed={windowMs === item.id} onClick={() => onChange(item.id)}>
          {t(item.key)}
        </button>
      ))}
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: ReactNode; accent: string }) {
  return (
    <Card accent={accent} className="tile">
      <div className="label">{label}</div>
      <div className="num">{value}</div>
    </Card>
  );
}
