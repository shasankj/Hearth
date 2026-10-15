import { useState } from 'react';
import { FilterPanel } from './FilterPanel.jsx';
import { Dialog } from './Dialog.jsx';
import { SaveSearchButton } from './SaveSearch.jsx';
import { SearchBar } from './SearchBar.jsx';
import { SORTS, STATUS_TABS, activeCount } from '../lib/filters.js';

function StatusTabs({ value, onChange }) {
  return (
    <div className="tabs" role="tablist" aria-label="Listing type">
      {STATUS_TABS.map(([v, text]) => (
        <button key={v} type="button" role="tab" aria-selected={value === v} className={value === v ? 'tab on' : 'tab'} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

function ViewToggle({ value, onChange }) {
  return (
    <div className="seg" role="group" aria-label="View">
      {[['list', 'List'], ['split', 'Split'], ['map', 'Map']].map(([v, text]) => (
        <button key={v} type="button" data-cy={`view-${v}`} aria-pressed={value === v} className={value === v ? 'seg-btn on' : 'seg-btn'} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

function SortSelect({ value, onChange }) {
  return (
    <label className="sort"><span>Sort</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>{SORTS.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select>
    </label>
  );
}

function FilterDialog({ filters, update, reset, onClose }) {
  return (
    <Dialog title="Filters" size="md" onClose={onClose}>
      <h2>Filters</h2>
      <FilterPanel filters={filters} update={update} reset={reset} />
      <button type="button" className="btn" onClick={onClose}>Show homes</button>
    </Dialog>
  );
}

function MobileFilters(props) {
  const [open, setOpen] = useState(false);
  const count = activeCount(props.filters);
  return (
    <>
      <button type="button" className="pill only-mobile" data-cy="filters-open" onClick={() => setOpen(true)}>⚙ Filters{count ? ` (${count})` : ''}</button>
      {open && <FilterDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function Row({ filters, update, reset }) {
  const changeStatus = (status) => update({ status, minPrice: 0, maxPrice: 0 }); // price steps differ for rent vs sale
  return (
    <div className="toolbar-row">
      <StatusTabs value={filters.status} onChange={changeStatus} />
      <MobileFilters filters={filters} update={update} reset={reset} />
      <SortSelect value={filters.sort} onChange={(sort) => update({ sort })} />
      <ViewToggle value={filters.view} onChange={(view) => update({ view })} />
      <SaveSearchButton filters={filters} />
    </div>
  );
}

export function SearchToolbar({ filters, update, reset, searchRef }) {
  return (
    <div className="toolbar">
      <SearchBar value={filters.q} status={filters.status} inputRef={searchRef} onSubmit={(q) => update({ q })} />
      <Row filters={filters} update={update} reset={reset} />
    </div>
  );
}
