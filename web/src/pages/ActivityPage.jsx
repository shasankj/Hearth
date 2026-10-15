import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { EmptyState, ErrorState, Spinner } from '../components/States.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useTitle } from '../hooks/useTitle.js';
import { money, shortDate } from '../lib/format.js';
import { useToast } from '../state/ToastContext.jsx';

const STEPS = [['submitted', 'Submitted'], ['inspection', 'Inspection'], ['awaiting_financing', 'Financing'], ['closing', 'Closing'], ['closed', 'Closed']];
const DONE = ['closed', 'expired', 'unknown'];

function Timeline({ step }) {
  const at = STEPS.findIndex(([k]) => k === step);
  if (step === 'expired') return <p className="bad">Expired: financing was not approved in time.</p>;
  return (
    <ol className="timeline" data-cy="timeline" data-step={step}>
      {STEPS.map(([k, t], i) => <li key={k} className={i < at ? 'done' : i === at ? 'now' : ''}>{t}</li>)}
    </ol>
  );
}

function Approve({ offer, onDone }) {
  const { notify } = useToast();
  const click = async () => {
    await api.approveFinancing(offer.id).catch((e) => notify(e.message, 'error'));
    notify('Lender approval sent to the workflow', 'success');
    setTimeout(onDone, 800);
  };
  return <button type="button" className="btn small" data-cy="approve" onClick={click}>Simulate lender approval</button>;
}

function OfferHead({ offer }) {
  return (
    <div className="offer-head">
      <div><b><Link to={`/homes/${offer.listingId}`}>{offer.address}</Link></b><small>{offer.city}</small></div>
      <div className="right"><b>{money(offer.amountUsd)}</b><small>asking {money(offer.askingUsd)}</small></div>
    </div>
  );
}

function OfferCard({ offer, onChange }) {
  return (
    <li className="card-panel offer" data-cy="offer">
      <OfferHead offer={offer} />
      <Timeline step={offer.step} />
      {offer.step === 'awaiting_financing' && <Approve offer={offer} onDone={onChange} />}
      <small className="hint">Tracked by a Temporal workflow ({offer.workflowId}). Waits up to 72 h for financing, then expires.</small>
    </li>
  );
}

function List({ items, render, empty }) {
  if (items.length === 0) return <EmptyState title={empty} hint="" />;
  return <ul className="stack-list">{items.map(render)}</ul>;
}

// Offers move through steps on their own (the Go worker), so poll while any offer is still in flight.
function usePolling(data, reload) {
  const active = data?.offers.some((o) => !DONE.includes(o.step));
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(reload, 4000);
    return () => clearInterval(t);
  }, [active, reload]);
}

const row = (title, sub) => <><b>{title}</b><small>{sub}</small></>;

export default function ActivityPage() {
  const [tab, setTab] = useState('offers');
  const { data, loading, error, reload } = useFetch((s) => api.activity(s), []);
  usePolling(data, reload);
  useTitle('My activity');
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <Spinner />;
  return (
    <section className="page">
      <h1>My activity</h1>
      <div className="tabs" role="tablist">
        {[['offers', `Offers (${data.offers.length})`], ['tours', `Tours (${data.tours.length})`], ['inquiries', `Messages (${data.inquiries.length})`]].map(([v, t]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} className={tab === v ? 'tab on' : 'tab'} data-cy={`tab-${v}`} onClick={() => setTab(v)}>{t}</button>
        ))}
      </div>
      {tab === 'offers' && <List items={data.offers} empty="No offers yet" render={(o) => <OfferCard key={o.id} offer={o} onChange={reload} />} />}
      {tab === 'tours' && <List items={data.tours} empty="No tours booked" render={(t) => <li key={t.id} className="card-panel" data-cy="tour">{row(`${t.address}, ${t.city}`, `Tour on ${shortDate(t.date)}`)}</li>} />}
      {tab === 'inquiries' && <List items={data.inquiries} empty="No messages sent" render={(i) => <li key={i.id} className="card-panel">{row(`${i.address}, ${i.city}`, i.message)}</li>} />}
    </section>
  );
}
