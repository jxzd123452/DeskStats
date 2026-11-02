import { useEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { formatRate } from "../lib/format";
import { useDesk } from "../state";
import { hexAlpha } from "../theme";

export interface ChartSeries {
  label: string;
  color: string;
  data: number[];
  fill?: boolean;
  rate?: boolean;
}

export function TimeChart({
  x,
  series,
  height = 120,
  fill = false,
  yMin = 0,
  yMax = null,
  grid,
  interactive = true,
}: {
  x: number[];
  series: ChartSeries[];
  height?: number;
  fill?: boolean;
  yMin?: number;
  yMax?: number | null;
  grid: string;
  interactive?: boolean;
}) {
  const { theme } = useDesk();
  const host = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const latest = useRef({ x, series });

  const colorKey = series.map((item) => item.color).join("|");
  const labelKey = series.map((item) => `${item.label}:${item.rate ? 1 : 0}:${item.fill === false ? 0 : 1}`).join("|");
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const gridColor = resolveColor(grid);
    const width = Math.max(20, Math.floor(el.clientWidth));
    const chartHeight = fill ? Math.max(48, Math.floor(el.clientHeight) || height) : height;
    latest.current = { x, series };
    const current = latest.current;
    const opts: uPlot.Options = {
      width,
      height: chartHeight,
      pxAlign: false,
      cursor: {
        show: interactive,
        x: true,
        y: false,
        drag: { x: false, y: false, setScale: false },
        points: {
          size: 7,
          width: 2,
          stroke: "rgba(255,255,255,0.9)",
          fill: (_u, seriesIdx) => current.series[seriesIdx - 1]?.color ?? "#fff",
        },
      },
      legend: { show: false },
      scales: {
        x: {
          time: false,
          range: (_u, min, max) => [min, max],
        },
        y: {
          range: (_u, min, max) => {
            if (yMax != null) return [yMin, yMax];
            if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
              return [0, Math.max(1, max || 1)];
            }
            const pad = (max - min) * 0.16;
            return [Math.max(0, min - pad * 0.15), max + pad];
          },
        },
      },
      axes: [
        { show: false },
        {
          show: true,
          stroke: gridColor,
          ticks: { show: false, stroke: gridColor, size: 0 },
          border: { show: false, stroke: gridColor, width: 1 },
          grid: { show: true, stroke: gridColor, width: 1 },
          values: () => [],
          splits: (u) => {
            const min = u.scales.y.min ?? 0;
            const max = u.scales.y.max ?? 1;
            return [0.28, 0.56, 0.84].map((p) => min + (max - min) * p);
          },
        },
      ],
      series: [
        {},
        ...current.series.map((item) => ({
          label: item.label,
          stroke: item.color,
          width: 1.5,
          fill: item.fill === false ? undefined : makeFill(item.color),
          points: { show: false },
        })),
      ],
      hooks: {
        setCursor: [
          (u) => {
            const node = tip.current;
            if (!node || !interactive) return;
            const idx = u.cursor.idx;
            if (idx == null || idx < 0) {
              node.style.opacity = "0";
              return;
            }
            const lines = latest.current.series.map((item, seriesIdx) => {
              const raw = u.data[seriesIdx + 1]?.[idx];
              const value = raw == null ? "—" : item.rate ? rateText(raw) : raw.toFixed(1);
              return `${item.label}  ${value}`;
            });
            node.textContent = lines.join("\n");
            const left = u.valToPos(u.data[0][idx] ?? 0, "x");
            const clamped = Math.max(0, Math.min(left + 10, Math.max(0, u.width - 128)));
            node.style.transform = `translate(${clamped}px, 6px)`;
            node.style.opacity = "1";
          },
        ],
      },
      padding: [8, 0, 2, 0],
    };
    const chart = new uPlot(opts, toData(current.x, current.series), el);
    plot.current = chart;
    const ro = new ResizeObserver(() => {
      const next = Math.max(20, Math.floor(el.clientWidth));
      const nextHeight = fill ? Math.max(48, Math.floor(el.clientHeight) || height) : height;
      chart.setSize({ width: next, height: nextHeight });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.destroy();
      plot.current = null;
    };
    // x/series are read from this render when the visual options change.
    // Streaming samples update the chart through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, fill, colorKey, labelKey, grid, theme, yMin, yMax, interactive]);

  useEffect(() => {
    latest.current = { x, series };
    plot.current?.setData(toData(x, series), false);
  }, [x, series]);

  return (
    <div className="chart-slot" ref={host}>
      <div className="chart-tip num" ref={tip} />
    </div>
  );
}

function resolveColor(input: string): string {
  const match = /var\((--[\w-]+)\)/.exec(input);
  if (!match || typeof document === "undefined") return input;
  const value = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
  return value || input;
}

function toData(x: number[], series: ChartSeries[]): uPlot.AlignedData {
  const xs = x.length >= 2 ? x : [0, 1];
  const cols = series.map((item) => {
    if (item.data.length >= 2) return item.data;
    const v = item.data[0] ?? 0;
    return [v, v];
  });
  return [xs, ...cols];
}

function makeFill(color: string) {
  return (u: uPlot) => {
    const top = u.bbox.top;
    const height = u.bbox.height;
    const gradient = u.ctx.createLinearGradient(0, top, 0, top + height);
    gradient.addColorStop(0, hexAlpha(color, 0.2));
    gradient.addColorStop(1, hexAlpha(color, 0));
    return gradient;
  };
}

function rateText(value: number): string {
  const q = formatRate(value);
  return `${q.value} ${q.unit}`;
}

export function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <svg className="spark" width="100%" height="28" />;
  const max = Math.max(100, ...values);
  const min = 0;
  const w = 120;
  const h = 28;
  const step = w / (values.length - 1);
  const d = values
    .map((value, index) => {
      const x = index * step;
      const y = h - ((value - min) / (max - min)) * (h - 2) - 1;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width="100%" height="28" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
