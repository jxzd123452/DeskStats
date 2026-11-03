export interface SparkSeries {
  values: number[];
  color: string;
}

export function Sparkline({
  series,
  height = 36,
  min,
  max,
}: {
  series: SparkSeries[];
  height?: number;
  min?: number;
  max?: number;
}) {
  const width = 100;
  const usable = series.map((item) => item.values.filter((value) => Number.isFinite(value)));
  const flat = usable.flat();
  if (flat.length < 2) {
    const color = series[0]?.color ?? "currentColor";
    return (
      <svg className="spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke={color} strokeOpacity="0.35" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  const lo = min ?? Math.min(...flat);
  const hi = max ?? Math.max(...flat);
  const span = hi - lo || 1;
  const paths = series.map((item) => {
    const values = item.values.filter((value) => Number.isFinite(value));
    const step = values.length > 1 ? width / (values.length - 1) : width;
    const points = values.map((value, index) => {
      const x = index * step;
      const y = height - ((value - lo) / span) * (height - 3) - 1.5;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    });
    const line = points.join(" ");
    return { color: item.color, line };
  });
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {paths.map((path, index) => (
        <path
          key={`${index}-line`}
          d={path.line}
          fill="none"
          stroke={path.color}
          strokeWidth="1.75"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
