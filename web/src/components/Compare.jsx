import { useState } from 'react';
import { Link } from 'react-router-dom';
import { bathsLabel, money, number, priceLabel, pricePerSqft } from '../lib/format.js';
import { monthlyBreakdown } from '../lib/mortgage.js';
import { Dialog } from './Dialog.jsx';

const perSqft = (l) => pricePerSqft(l) ?? Infinity;
const dash = (fmt) => (n) => (Number.isFinite(n) ? fmt(n) : '–');
const monthly = (l) => (l.status === 'for_rent' ? l.priceUsd : Math.round(monthlyBreakdown(l.priceUsd, l.hoaMonthly).total));

const ROWS = [
  { label: 'Price', get: (l) => l.priceUsd, show: (n, l) => priceLabel({ ...l, priceUsd: n }), best: Math.min },
  { label: 'Bedrooms', get: (l) => l.beds, show: String, best: Math.max },
  { label: 'Bathrooms', get: (l) => l.baths, show: bathsLabel, best: Math.max },
  { label: 'Square feet', get: (l) => l.sqft, show: number, best: Math.max },
  { label: 'Price per sqft', get: perSqft, show: dash(money), best: Math.min },
  { label: 'Est. monthly cost', get: monthly, show: money, best: Math.min },
];

function Row({ row, items }) {
  const values = items.map(row.get);
  const best = row.best(...values);
  return (
    <tr>
      <th scope="row">{row.label}</th>
      {values.map((v, i) => <td key={items[i].id} className={v === best ? 'best' : ''}>{row.show(v, items[i])}</td>)}
    </tr>
  );
}

function CompareTable({ items }) {
  return (
    <table className="compare-table">
      <thead><tr><th />{items.map((l) => <th key={l.id} scope="col"><Link to={`/homes/${l.id}`}>{l.address}</Link><small>{l.city}</small></th>)}</tr></thead>
      <tbody>{ROWS.map((row) => <Row key={row.label} row={row} items={items} />)}</tbody>
    </table>
  );
}

export function CompareTray({ items, onRemove, onClear }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <aside className="tray" aria-label="Compare tray" data-cy="tray">
      <ul>{items.map((l) => <li key={l.id}>{l.address}<button type="button" aria-label={`Remove ${l.address}`} onClick={() => onRemove(l)}>✕</button></li>)}</ul>
      <button type="button" className="link" onClick={onClear}>Clear</button>
      <button type="button" className="btn small" data-cy="compare-open" disabled={items.length < 2} onClick={() => setOpen(true)}>Compare {items.length}</button>
      {open && <Dialog title="Compare homes" size="lg" onClose={() => setOpen(false)}><h2>Compare homes</h2><CompareTable items={items} /><p className="hint">Highlighted = best value in each row.</p></Dialog>}
    </aside>
  );
}
