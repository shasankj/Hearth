import { useState } from 'react';
import { api } from '../api.js';
import { activeCount, toQuery } from '../lib/filters.js';
import { titleCase } from '../lib/format.js';
import { useSignInGate } from '../hooks/useSignInGate.js';
import { useToast } from '../state/ToastContext.jsx';
import { Dialog } from './Dialog.jsx';

const defaultName = (f) => [f.city || f.q || 'Anywhere', titleCase(f.status)].join(' · ');

function useSave(filters, name, alerts, onDone) {
  const { notify } = useToast();
  return async (e) => {
    e.preventDefault();
    const ok = await api.saveSearch({ name, alerts, query: toQuery(filters) }).then(() => true, () => false);
    notify(ok ? 'Search saved. Find it under Saved homes.' : 'Could not save the search', ok ? 'success' : 'error');
    if (ok) onDone();
  };
}

function SaveFields({ name, setName, alerts, setAlerts }) {
  return (
    <>
      <label className="field"><span>Name</span><input value={name} maxLength={60} required onChange={(e) => setName(e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={alerts} onChange={(e) => setAlerts(e.target.checked)} /> Email me when new homes match</label>
    </>
  );
}

function SaveForm({ filters, onDone }) {
  const [name, setName] = useState(defaultName(filters));
  const [alerts, setAlerts] = useState(true);
  const submit = useSave(filters, name, alerts, onDone);
  return (
    <form onSubmit={submit} className="stack">
      <h2>Save this search</h2>
      <SaveFields name={name} setName={setName} alerts={alerts} setAlerts={setAlerts} />
      <button type="submit" className="btn">Save search</button>
    </form>
  );
}

// Needs an account (saved searches live on the server). Sends signed-out users to sign in, then back here.
export function SaveSearchButton({ filters }) {
  const [open, setOpen] = useState(false);
  const click = useSignInGate(() => setOpen(true));
  const count = activeCount(filters);
  return (
    <>
      <button type="button" className="pill" data-cy="save-search" onClick={click}>♡ Save search{count ? ` (${count})` : ''}</button>
      {open && <Dialog title="Save search" size="sm" onClose={() => setOpen(false)}><SaveForm filters={filters} onDone={() => setOpen(false)} /></Dialog>}
    </>
  );
}
