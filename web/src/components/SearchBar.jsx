import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useDebounce } from '../hooks/useDebounce.js';

// Typeahead: addresses that match what you typed (top 5), debounced so we don't fire a request per keystroke.
function useSuggestions(text, status) {
  const [items, setItems] = useState([]);
  const q = useDebounce(text.trim(), 250);
  useEffect(() => {
    if (q.length < 2) { setItems([]); return undefined; }
    const ctrl = new AbortController();
    api.searchListings({ q, status, pageSize: 5 }, ctrl.signal).then((r) => setItems(r.listings)).catch(() => {});
    return () => ctrl.abort();
  }, [q, status]);
  return items;
}

function Suggestion({ l, onPick }) {
  return (
    <li role="option" aria-selected="false">
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(l)}>
        <b>{l.address}</b><span>{l.neighborhood}, {l.city}</span>
      </button>
    </li>
  );
}

function Suggestions({ id, items, onPick }) {
  if (items.length === 0) return null;
  return <ul className="suggest" id={id} role="listbox">{items.map((l) => <Suggestion key={l.id} l={l} onPick={onPick} />)}</ul>;
}

function Input({ id, listId, inputRef, text, open, hasItems, onText, onBlur }) {
  return (
    <>
      <label className="sr-only" htmlFor={id}>Search by city, neighborhood, address or ZIP</label>
      <input id={id} ref={inputRef} type="search" autoComplete="off" placeholder="City, neighborhood, address or ZIP   ( / )" value={text}
      role="combobox" aria-expanded={open && hasItems} aria-controls={listId} onChange={(e) => onText(e.target.value)} onBlur={onBlur} />
    </>
  );
}

function useTypeahead(value, status, onSubmit) {
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const items = useSuggestions(text, status);
  useEffect(() => setText(value), [value]);
  const submit = (e) => { e.preventDefault(); setOpen(false); onSubmit(text.trim()); };
  const type = (t) => { setText(t); setOpen(true); };
  return { text, open, items, submit, type, close: () => setOpen(false) };
}

export function SearchBar({ value = '', status = 'for_sale', onSubmit, large = false, inputRef }) {
  const listId = useId();
  const navigate = useNavigate();
  const t = useTypeahead(value, status, onSubmit);
  return (
    <form className={large ? 'searchbar large' : 'searchbar'} role="search" onSubmit={t.submit}>
      <Input id={`${listId}-in`} listId={listId} inputRef={inputRef} text={t.text} open={t.open} hasItems={t.items.length > 0} onText={t.type} onBlur={t.close} />
      <button type="submit" className="btn">Search</button>
      {t.open && <Suggestions id={listId} items={t.items} onPick={(l) => navigate(`/homes/${l.id}`)} />}
    </form>
  );
}
