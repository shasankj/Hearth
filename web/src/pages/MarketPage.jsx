import { useMemo, useReducer } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { ErrorState, Spinner } from '../components/States.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useTitle } from '../hooks/useTitle.js';
import { SALE_PRICES } from '../lib/filters.js';
import { compact, money } from '../lib/format.js';
import { DEFAULT_TERMS, affordablePrice } from '../lib/mortgage.js';

function BarRow({ label, ratio, text }) {
  return <li><span>{label}</span><i style={{ width: `${ratio * 100}%` }} /><b>{text}</b></li>;
}

function Bars({ title, rows, value, format }) {
  const max = Math.max(...rows.map(value), 1);
  return (
    <section className="card-panel" aria-label={title}>
      <h3>{title}</h3>
      <ul className="bars">{rows.map((c) => <BarRow key={c.city} label={c.city} ratio={value(c) / max} text={format(value(c))} />)}</ul>
    </section>
  );
}

function AffordInputs({ s, set }) {
  return (
    <>
      <label className="field"><span>Household income / year</span><input type="number" min={20000} step={5000} value={s.income} onChange={(e) => set({ income: Number(e.target.value) })} data-cy="income" /></label>
      <label className="field"><span>Down payment {s.downPct}%</span><input type="range" min={0} max={50} value={s.downPct} onChange={(e) => set({ downPct: Number(e.target.value) })} /></label>
      <label className="field"><span>Interest rate {s.rate}%</span><input type="range" min={2} max={10} step={0.125} value={s.rate} onChange={(e) => set({ rate: Number(e.target.value) })} /></label>
    </>
  );
}

const nearestStep = (price) => [...SALE_PRICES].reverse().find((p) => p <= price) ?? SALE_PRICES[0];
const stateReducer = (a, b) => ({ ...a, ...b });
const loanTerms = (s) => ({ ...DEFAULT_TERMS, downPct: s.downPct, rate: s.rate });

function Affordability() {
  const [s, set] = useReducer(stateReducer, { income: 120000, downPct: 20, rate: 6.5 });
  const price = useMemo(() => affordablePrice(s.income / 12, loanTerms(s)), [s]);
  return (
    <section className="card-panel afford" aria-label="Affordability calculator">
      <h3>What can I afford?</h3>
      <AffordInputs s={s} set={set} />
      <output className="big" data-cy="afford">{money(price)}</output>
      <Link className="btn small" to={`/homes?maxPrice=${nearestStep(price)}`}>See homes up to {compact(nearestStep(price))}</Link>
    </section>
  );
}

function Table({ cities }) {
  return (
    <table className="history market-table">
      <thead><tr><th>City</th><th>Homes</th><th>Median</th><th>Avg $/sqft</th><th>Avg days</th></tr></thead>
      <tbody>
        {cities.map((c) => (
          <tr key={c.city}><td><Link to={`/homes?city=${encodeURIComponent(c.city)}`}>{c.city}</Link></td><td>{c.listings}</td><td>{money(c.medianPriceUsd)}</td><td>{money(Math.round(c.avgPricePerSqft))}</td><td>{Math.round(c.avgDaysOnMarket)}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

export default function MarketPage() {
  const { data, loading, error, reload } = useFetch((s) => api.market(s), []);
  useTitle('Market insights');
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <Spinner />;
  const cities = [...data.cities].sort((a, b) => b.medianPriceUsd - a.medianPriceUsd);
  return (
    <section className="page">
      <h1>Market insights</h1>
      <p className="hint">Live numbers from homes currently for sale. Nightly aggregates also land in the analytics schema via Airflow.</p>
      <div className="insights">
        <Bars title="Median price" rows={cities} value={(c) => c.medianPriceUsd} format={compact} />
        <Bars title="Price per sqft" rows={[...cities].sort((a, b) => b.avgPricePerSqft - a.avgPricePerSqft)} value={(c) => c.avgPricePerSqft} format={(n) => money(Math.round(n))} />
        <Bars title="Days on market" rows={[...cities].sort((a, b) => a.avgDaysOnMarket - b.avgDaysOnMarket)} value={(c) => c.avgDaysOnMarket} format={(n) => `${Math.round(n)} d`} />
        <Affordability />
      </div>
      <Table cities={cities} />
    </section>
  );
}
