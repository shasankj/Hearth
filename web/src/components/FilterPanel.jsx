import { FEATURES, TYPES, priceSteps } from '../lib/filters.js';
import { compact, titleCase } from '../lib/format.js';

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  );
}

function Section({ title, children }) {
  return <fieldset className="fsec"><legend>{title}</legend>{children}</fieldset>;
}

function Segmented({ label, value, options, onChange }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={value === v} className={value === v ? 'seg-btn on' : 'seg-btn'} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

function CheckList({ options, value, onChange }) {
  const toggle = (k) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return (
    <div className="checks">
      {options.map(([k, text]) => (
        <label key={k} className="check"><input type="checkbox" checked={value.includes(k)} onChange={() => toggle(k)} /> {text}</label>
      ))}
    </div>
  );
}

function Price({ f, update }) {
  const steps = [[0, 'Any'], ...priceSteps(f.status).map((p) => [p, compact(p)])];
  return (
    <Section title={f.status === 'for_rent' ? 'Monthly rent' : 'Price'}>
      <div className="row2">
        <SelectField label="Min" value={f.minPrice} options={steps} onChange={(v) => update({ minPrice: v })} />
        <SelectField label="Max" value={f.maxPrice} options={steps} onChange={(v) => update({ maxPrice: v })} />
      </div>
    </Section>
  );
}

function Rooms({ f, update }) {
  return (
    <>
      <Section title="Bedrooms"><Segmented label="Minimum bedrooms" value={f.beds} onChange={(v) => update({ beds: v })} options={[[0, 'Any'], [1, '1+'], [2, '2+'], [3, '3+'], [4, '4+'], [5, '5+']]} /></Section>
      <Section title="Bathrooms"><Segmented label="Minimum bathrooms" value={f.baths} onChange={(v) => update({ baths: v })} options={[[0, 'Any'], [1, '1+'], [1.5, '1.5+'], [2, '2+'], [3, '3+']]} /></Section>
    </>
  );
}

const SQFT = [[0, 'Any'], ...[500, 750, 1000, 1500, 2000, 3000].map((n) => [n, `${n} sqft`])];
const YEARS = [[0, 'Any'], ...[1950, 1980, 2000, 2010, 2020].map((n) => [n, `${n}+`])];

function Details({ f, update }) {
  return (
    <Section title="Home details">
      <div className="row2">
        <SelectField label="Min size" value={f.minSqft} options={SQFT} onChange={(v) => update({ minSqft: v })} />
        <SelectField label="Max size" value={f.maxSqft} options={SQFT} onChange={(v) => update({ maxSqft: v })} />
      </div>
      <SelectField label="Year built" value={f.minYear} options={YEARS} onChange={(v) => update({ minYear: v })} />
    </Section>
  );
}

function PanelFooter({ f, update, reset }) {
  return (
    <>
      <label className="check"><input type="checkbox" checked={f.openHouse} onChange={(e) => update({ openHouse: e.target.checked })} /> Open houses only</label>
      <button type="button" className="link" onClick={reset}>Reset filters</button>
    </>
  );
}

// The same panel is used as a sidebar on desktop and inside a dialog on mobile.
export function FilterPanel({ filters: f, update, reset }) {
  return (
    <div className="filter-panel" aria-label="Filters">
      <Price f={f} update={update} />
      <Rooms f={f} update={update} />
      <Section title="Property type"><CheckList options={TYPES} value={f.types} onChange={(v) => update({ types: v })} /></Section>
      <Details f={f} update={update} />
      <Section title="Features"><CheckList options={FEATURES.map((x) => [x, titleCase(x)])} value={f.features} onChange={(v) => update({ features: v })} /></Section>
      <PanelFooter f={f} update={update} reset={reset} />
    </div>
  );
}
