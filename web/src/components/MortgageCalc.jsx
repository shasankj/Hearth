import { useId, useMemo, useReducer } from 'react';
import { DEFAULT_TERMS, monthlyBreakdown, termsReducer } from '../lib/mortgage.js';
import { money } from '../lib/format.js';

function Slider({ label, unit, value, onChange, ...range }) {
  const id = useId();
  return (
    <div className="slider">
      <label htmlFor={id}>{label} <b>{value}{unit}</b></label>
      <input id={id} type="range" value={value} onChange={(e) => onChange(Number(e.target.value))} {...range} />
    </div>
  );
}

function Sliders({ terms, dispatch }) {
  const set = (key) => (value) => dispatch({ key, value });
  return (
    <>
      <Slider label="Down payment" unit="%" min={0} max={50} step={1} value={terms.downPct} onChange={set('downPct')} />
      <Slider label="Interest rate" unit="%" min={2} max={10} step={0.125} value={terms.rate} onChange={set('rate')} />
      <Slider label="Loan term" unit=" yrs" min={10} max={30} step={5} value={terms.years} onChange={set('years')} />
    </>
  );
}

const PARTS = [['pi', 'Principal & interest'], ['tax', 'Property tax'], ['insurance', 'Insurance'], ['hoa', 'HOA']];

// A stacked bar + legend showing where each monthly dollar goes.
function Breakdown({ b }) {
  return (
    <>
      <div className="stack-bar" aria-hidden="true">
        {PARTS.map(([k]) => <span key={k} className={`seg-${k}`} style={{ width: `${(b[k] / b.total) * 100}%` }} />)}
      </div>
      <ul className="legend">{PARTS.filter(([k]) => b[k] > 0).map(([k, text]) => <li key={k}><i className={`seg-${k}`} />{text}<b>{money(Math.round(b[k]))}</b></li>)}</ul>
    </>
  );
}

// useReducer: five related inputs, one update function. useMemo: recompute only when inputs change.
export function MortgageCalc({ price, hoa = 0 }) {
  const [terms, dispatch] = useReducer(termsReducer, DEFAULT_TERMS);
  const b = useMemo(() => monthlyBreakdown(price, hoa, terms), [price, hoa, terms]);
  return (
    <section className="calc card-panel" aria-label="Mortgage calculator">
      <h3>Estimated monthly payment</h3>
      <output className="big" data-cy="monthly">{money(Math.round(b.total))}</output>
      <Breakdown b={b} />
      <Sliders terms={terms} dispatch={dispatch} />
    </section>
  );
}
