import { Link } from 'react-router-dom';
import { bathsLabel, number, priceLabel } from '../lib/format.js';
import { Photo } from './Scenes.jsx';

function Facts({ l }) {
  return <p className="facts"><span><b>{l.beds}</b> bd</span><span><b>{bathsLabel(l.baths)}</b> ba</span><span><b>{number(l.sqft)}</b> sqft</span></p>;
}

function PreviewBody({ l }) {
  return (
    <Link to={`/homes/${l.id}`}>
      <div className="media"><Photo listing={l} kind="exterior" /></div>
      <p className="price">{priceLabel(l)}</p>
      <Facts l={l} />
      <p className="addr">{l.address}, {l.city}</p>
    </Link>
  );
}

// The card that pops up when you click a price pin.
export function MapPreview({ listing, onClose }) {
  return (
    <aside className="map-preview" aria-label="Selected home">
      <button type="button" className="icon small close" aria-label="Close preview" onClick={onClose}>✕</button>
      <PreviewBody l={listing} />
    </aside>
  );
}
