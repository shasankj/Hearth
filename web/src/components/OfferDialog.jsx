import { useReducer, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { money } from '../lib/format.js';
import { Dialog } from './Dialog.jsx';

const FINANCING = [['conventional', 'Conventional loan'], ['fha', 'FHA loan'], ['va', 'VA loan'], ['cash', 'Cash']];
const CONTINGENCIES = [['inspection', 'Home inspection'], ['appraisal', 'Appraisal'], ['financing', 'Financing'], ['sale_of_home', 'Sale of my current home']];
const STEPS = ['Amount', 'Terms', 'Review'];

const reducer = (s, patch) => ({ ...s, ...patch });
const pct = (price, p) => Math.round((price * (1 + p / 100)) / 1000) * 1000;

function QuickAmounts({ price, set }) {
  return (
    <div className="quick">
      {[-5, 0, 3].map((p) => <button key={p} type="button" className="chip" onClick={() => set({ amountUsd: pct(price, p) })}>{p === 0 ? 'Asking' : `${p > 0 ? '+' : ''}${p}%`}</button>)}
    </div>
  );
}

function FinancingSelect({ value, onChange }) {
  return (
    <label className="field"><span>Financing</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>{FINANCING.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
    </label>
  );
}

function AmountStep({ listing, s, set }) {
  return (
    <div className="stack">
      <p className="hint">Asking price {money(listing.priceUsd)}</p>
      <label className="field"><span>Your offer</span>
        <input type="number" min={1000} step={1000} value={s.amountUsd || ''} data-cy="offer-amount" onChange={(e) => set({ amountUsd: Number(e.target.value) })} />
      </label>
      <QuickAmounts price={listing.priceUsd} set={set} />
      <FinancingSelect value={s.financing} onChange={(financing) => set({ financing })} />
    </div>
  );
}

function TermsStep({ s, set }) {
  const toggle = (k) => set({ contingencies: s.contingencies.includes(k) ? s.contingencies.filter((x) => x !== k) : [...s.contingencies, k] });
  return (
    <div className="stack">
      <fieldset className="fsec"><legend>Contingencies</legend>
        <div className="checks">{CONTINGENCIES.map(([k, t]) => <label key={k} className="check"><input type="checkbox" checked={s.contingencies.includes(k)} onChange={() => toggle(k)} /> {t}</label>)}</div>
      </fieldset>
      <label className="field"><span>Preferred closing date</span><input type="date" value={s.closingDate} onChange={(e) => set({ closingDate: e.target.value })} /></label>
    </div>
  );
}

function ReviewStep({ listing, s }) {
  return (
    <dl className="review">
      <dt>Home</dt><dd>{listing.address}, {listing.city}</dd>
      <dt>Offer</dt><dd><b>{money(s.amountUsd)}</b></dd>
      <dt>Financing</dt><dd>{FINANCING.find(([v]) => v === s.financing)[1]}</dd>
      <dt>Contingencies</dt><dd>{s.contingencies.join(', ') || 'None'}</dd>
      <dt>Closing</dt><dd>{s.closingDate || 'Flexible'}</dd>
    </dl>
  );
}

function Done({ onClose }) {
  return (
    <div className="state" data-cy="offer-done">
      <div className="state-art" aria-hidden="true">✓</div>
      <h2>Offer submitted</h2>
      <p>We started tracking it. Follow every step, and approve financing, from your activity page.</p>
      <Link className="btn" to="/activity" onClick={onClose}>Track my offer</Link>
    </div>
  );
}

const Back = ({ onClick }) => <button type="button" className="btn ghost" onClick={onClick}>Back</button>;
const Next = ({ onClick }) => <button type="button" className="btn" data-cy="offer-next" onClick={onClick}>Continue</button>;
const Send = ({ busy, onClick }) => <button type="button" className="btn" data-cy="offer-submit" disabled={busy} onClick={onClick}>{busy ? 'Submitting…' : 'Submit offer'}</button>;

function Footer({ step, setStep, busy, onSubmit }) {
  return (
    <div className="dialog-actions">
      {step > 0 && <Back onClick={() => setStep(step - 1)} />}
      {step < 2 ? <Next onClick={() => setStep(step + 1)} /> : <Send busy={busy} onClick={onSubmit} />}
    </div>
  );
}

const payload = (listing, s) => ({
  listingId: listing.id, amountUsd: s.amountUsd, financing: s.financing, contingencies: s.contingencies,
  ...(s.closingDate ? { closingDate: s.closingDate } : {}),
});

// Resolves to an error message, or null on success (so the caller has no try/catch).
const send = (listing, s) => api.offer(payload(listing, s)).then(() => null, (err) => err.message);

function useSubmit(listing, s, onDone) {
  const [state, setState] = useState({ busy: false, error: null });
  const submit = async () => {
    setState({ busy: true, error: null });
    const error = await send(listing, s);
    if (error) setState({ busy: false, error });
    else onDone();
  };
  return { ...state, submit };
}

const draft = (listing) => ({ amountUsd: listing.priceUsd, financing: 'conventional', contingencies: ['inspection'], closingDate: '' });

function Progress({ step }) {
  return (
    <>
      <h2>Make an offer</h2>
      <ol className="steps">{STEPS.map((t, i) => <li key={t} className={i === step ? 'on' : i < step ? 'done' : ''}>{t}</li>)}</ol>
    </>
  );
}

function StepBody({ step, ...props }) {
  const Body = [AmountStep, TermsStep, ReviewStep][step];
  return <Body {...props} />;
}

function useWizard(listing) {
  const [s, set] = useReducer(reducer, listing, draft);
  const [step, setStep] = useState(0);
  return { s, set, step, setStep };
}

function Wizard({ listing, onDone }) {
  const { s, set, step, setStep } = useWizard(listing);
  const { busy, error, submit } = useSubmit(listing, s, onDone);
  return (
    <>
      <Progress step={step} />
      <StepBody step={step} listing={listing} s={s} set={set} />
      {error && <p role="alert" className="bad">{error}</p>}
      <Footer step={step} setStep={setStep} busy={busy} onSubmit={submit} />
    </>
  );
}

// 3-step wizard: amount → terms → review. useReducer holds the draft; the Temporal workflow starts on submit.
export function OfferDialog({ listing, onClose }) {
  const [done, setDone] = useState(false);
  return (
    <Dialog title="Make an offer" size="md" onClose={onClose}>
      {done ? <Done onClose={onClose} /> : <Wizard listing={listing} onDone={() => setDone(true)} />}
    </Dialog>
  );
}
