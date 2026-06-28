/**
 * Lightweight SVG charts for the console, built only on DS color tokens.
 *
 * The DS has no chart primitives, so these are arda-local. They take token
 * strings (e.g. `var(--vx-color-primary)`) for every color - never raw hex - so
 * they respect theming and the DS-usage gate.
 */

const PRIMARY = "var(--vx-color-primary)";
const BORDER = "var(--vx-color-border)";
const SURFACE = "var(--vx-color-surface)";

/** Soft token tint via color-mix, used for area/sparkline fills. */
function tint(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

export interface AreaPoint {
  m?: string;
  v: number;
}

export function AreaChart({
  data,
  height = 120,
  color = PRIMARY,
  id = "ar",
}: {
  data: Array<number | AreaPoint>;
  height?: number;
  color?: string;
  id?: string;
}) {
  const w = 520;
  const h = height;
  const pad = 6;
  const vals = data.map((d) => (typeof d === "number" ? d : d.v));
  const max = Math.max(...vals) * 1.08;
  const min = Math.min(...vals) * 0.92;
  const x = (i: number) => pad + (i * (w - pad * 2)) / (vals.length - 1);
  const y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2 - 14);
  const line = vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
  return (
    <svg
      className="chart"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height }}
      role="img"
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${id})`} points={area} />
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" points={line} />
      {vals.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={SURFACE} stroke={color} strokeWidth="2" />
      ))}
    </svg>
  );
}

export function Sparkline({
  data,
  color = PRIMARY,
  id,
  height = 36,
}: {
  data: number[];
  color?: string;
  id: string;
  height?: number;
}) {
  const w = 120;
  const h = height;
  const pad = 2;
  const max = Math.max(...data) * 1.05;
  const min = Math.min(...data) * 0.95;
  const x = (i: number) => pad + (i * (w - pad * 2)) / (data.length - 1);
  const y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  const line = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height }} role="img">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${id})`} points={`${pad},${h} ${line} ${w - pad},${h}`} />
      <polyline fill="none" stroke={color} strokeWidth="2" points={line} />
    </svg>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  color: string;
}

export function HBars({ data }: { data: BarDatum[] }) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div className="hbars">
      {data.map((d) => (
        <div className="hbar-row" key={d.label}>
          <div className="hbar-label">{d.label}</div>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: (d.value / max) * 100 + "%", background: d.color }} />
          </div>
          <div className="hbar-val">{d.value.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

export function Donut({ data, size = 180, caption }: { data: DonutDatum[]; size?: number; caption?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  let off = 0;
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          {data.map((d, i) => {
            const frac = d.value / total;
            const seg = (
              <circle
                key={i}
                cx={cx}
                cy={cx}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth="20"
                strokeDasharray={`${frac * c} ${c}`}
                strokeDashoffset={-off * c}
                strokeLinecap="butt"
              />
            );
            off += frac;
            return seg;
          })}
        </g>
        <text x={cx} y={cx - 4} textAnchor="middle" className="donut-num">
          {total.toLocaleString()}
        </text>
        {caption && (
          <text x={cx} y={cx + 16} textAnchor="middle" className="donut-cap">
            {caption}
          </text>
        )}
      </svg>
      <div className="donut-legend">
        {data.map((d) => (
          <div className="dl-row" key={d.label}>
            <span className="dl-dot" style={{ background: d.color }} />
            <span className="dl-label">{d.label}</span>
            <span className="dl-val">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface RadarDatum {
  name: string;
  score: number;
}

export function Radar({ data, size = 220 }: { data: RadarDatum[]; size?: number }) {
  const cx = size / 2;
  const R = size / 2 - 32;
  const n = data.length;
  const ang = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, frac: number): [number, number] => [
    cx + Math.cos(ang(i)) * R * frac,
    cx + Math.sin(ang(i)) * R * frac,
  ];
  const poly = data.map((d, i) => pt(i, d.score / 100).join(",")).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="radar" role="img">
      {[0.25, 0.5, 0.75, 1].map((f, i) => (
        <polygon
          key={i}
          points={data.map((_, j) => pt(j, f).join(",")).join(" ")}
          fill="none"
          stroke={BORDER}
          strokeWidth="1"
        />
      ))}
      {data.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cx} x2={x} y2={y} stroke={BORDER} strokeWidth="1" />;
      })}
      <polygon points={poly} fill={tint(PRIMARY, 18)} stroke={PRIMARY} strokeWidth="2" />
      {data.map((d, i) => {
        const [x, y] = pt(i, d.score / 100);
        const [lx, ly] = pt(i, 1.2);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="3" fill={PRIMARY} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="radar-label">
              {d.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Ring({
  score,
  size = 96,
  color = PRIMARY,
  label,
}: {
  score: number;
  size?: number;
  color?: string;
  label?: string;
}) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  return (
    <div className="ring-wrap" style={{ width: size }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={BORDER} strokeWidth="8" />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`}
          transform={`rotate(-90 ${cx} ${cx})`}
        />
        <text x={cx} y={cx + 1} textAnchor="middle" dominantBaseline="middle" className="ring-num">
          {score}
        </text>
      </svg>
      {label && <div className="ring-label">{label}</div>}
    </div>
  );
}
