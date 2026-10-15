import { compact, money, shortDate, titleCase } from '../lib/format.js';

const W = 420;
const H = 150;
const PAD = 28;

// Maps price history points onto SVG coordinates (x = time, y = price, step chart).
export function plot(points) {
  const times = points.map((p) => new Date(p.date).getTime());
  const prices = points.map((p) => p.priceUsd);
  const [t0, t1] = [Math.min(...times), Math.max(...times)];
  const [lo, hi] = [Math.min(...prices), Math.max(...prices)];
  const x = (t) => PAD + (t1 === t0 ? (W - 2 * PAD) / 2 : ((t - t0) / (t1 - t0)) * (W - 2 * PAD));
  const y = (p) => H - PAD - (hi === lo ? (H - 2 * PAD) / 2 : ((p - lo) / (hi - lo)) * (H - 2 * PAD));
  return points.map((p, i) => ({ ...p, cx: x(times[i]), cy: y(p.priceUsd) }));
}

const stepPath = (pts) => pts.map((p, i) => (i === 0 ? `M${p.cx} ${p.cy}` : `H${p.cx}V${p.cy}`)).join(' ');

function Dots({ pts }) {
  return pts.map((p, i) => (
    <circle key={i} cx={p.cx} cy={p.cy} r="4.5" className={`dot ${p.event}`}>
      <title>{`${titleCase(p.event)}: ${money(p.priceUsd)} on ${shortDate(p.date)}`}</title>
    </circle>
  ));
}

const clampX = (x) => Math.min(Math.max(x, PAD + 6), W - PAD - 6);

// Price above every point, plus first/last dates under the axis.
function Labels({ pts }) {
  const ends = [pts[0], pts[pts.length - 1]];
  return (
    <>
      {pts.map((p, i) => <text key={i} x={clampX(p.cx)} y={p.cy - 10} className="lbl">{compact(p.priceUsd)}</text>)}
      {ends.map((p, i) => <text key={`d${i}`} x={clampX(p.cx)} y={H - 8} className="lbl date">{shortDate(p.date)}</text>)}
    </>
  );
}

function Chart({ pts }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Price history chart">
      <path d={`M${PAD} ${H - PAD}H${W - PAD}`} className="axis" />
      <path d={stepPath(pts)} className="line" />
      <Dots pts={pts} />
      <Labels pts={pts} />
    </svg>
  );
}

export function PriceChart({ history }) {
  if (history.length === 0) return <p className="hint">No price history yet.</p>;
  return <figure className="chart"><Chart pts={plot(history)} /></figure>;
}

export function HistoryTable({ history }) {
  return (
    <table className="history">
      <thead><tr><th>Date</th><th>Event</th><th>Price</th></tr></thead>
      <tbody>{[...history].reverse().map((p, i) => <tr key={i}><td>{shortDate(p.date)}</td><td>{titleCase(p.event)}</td><td>{money(p.priceUsd)}</td></tr>)}</tbody>
    </table>
  );
}
