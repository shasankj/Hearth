import { useState } from 'react';
import { useSignInGate } from '../hooks/useSignInGate.js';
import { AgentCard } from './AgentCard.jsx';
import { InquiryForm } from './InquiryForm.jsx';
import { OfferDialog } from './OfferDialog.jsx';
import { TourForm } from './TourForm.jsx';

function Tabs({ value, onChange }) {
  return (
    <div className="tabs" role="tablist" aria-label="Contact options">
      {[['tour', 'Book a tour'], ['message', 'Message']].map(([v, t]) => (
        <button key={v} type="button" role="tab" aria-selected={value === v} className={value === v ? 'tab on' : 'tab'} data-cy={`tab-${v}`} onClick={() => onChange(v)}>{t}</button>
      ))}
    </div>
  );
}

function OfferButton({ listing }) {
  const [open, setOpen] = useState(false);
  const click = useSignInGate(() => setOpen(true));
  return (
    <>
      <button type="button" className="btn wide" data-cy="make-offer" onClick={click}>Make an offer</button>
      {open && <OfferDialog listing={listing} onClose={() => setOpen(false)} />}
    </>
  );
}

// Sticky sidebar: agent, tour/message tabs, and (for homes on sale) the offer button.
export function ContactPanel({ listing }) {
  const [tab, setTab] = useState('tour');
  return (
    <aside className="contact card-panel" aria-label="Contact">
      <AgentCard agent={listing.agent} />
      <Tabs value={tab} onChange={setTab} />
      {tab === 'tour' ? <TourForm listingId={listing.id} /> : <InquiryForm listing={listing} />}
      {listing.status === 'for_sale' && <OfferButton listing={listing} />}
    </aside>
  );
}
