import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { compact } from '../lib/format.js';

const pinIcon = (l, active) => L.divIcon({
  className: 'pin-wrap',
  html: `<span class="pin ${active ? 'active' : ''} ${l.status}">${compact(l.priceUsd)}</span>`,
  iconSize: [64, 26], iconAnchor: [32, 13],
});

// Fit the map to the results whenever they change (unless the user is exploring by hand).
function FitToResults({ listings, enabled, fitting }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || listings.length === 0) return;
    fitting.current = true;
    map.fitBounds(L.latLngBounds(listings.map((l) => [l.lat, l.lng])), { padding: [40, 40], maxZoom: 14 });
  }, [listings, enabled, map, fitting]);
  return null;
}

function UserMoves({ fitting, onMoved }) {
  const map = useMapEvents({
    moveend: () => (fitting.current ? (fitting.current = false) : onMoved(map.getBounds())),
  });
  return null;
}

function Pins({ listings, activeId, onPick }) {
  return listings.map((l) => (
    <Marker key={l.id} position={[l.lat, l.lng]} icon={pinIcon(l, l.id === activeId)} eventHandlers={{ click: () => onPick(l.id) }} keyboard />
  ));
}

function Controls({ moved, bounds, onSearchArea, onClearArea, clearMoved }) {
  if (bounds) return <button type="button" className="btn small ghost map-btn" onClick={() => { clearMoved(); onClearArea(); }}>✕ Clear map area</button>;
  return moved ? <button type="button" className="btn small map-btn" onClick={() => onSearchArea(moved)}>Search this area</button> : null;
}

const CENTER = [39.8, -98.5];

function Canvas({ listings, activeId, onPick, fitEnabled, fitting, onMoved }) {
  return (
    <MapContainer center={CENTER} zoom={4} scrollWheelZoom className="map" aria-label="Map of results">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitToResults listings={listings} enabled={fitEnabled} fitting={fitting} />
      <UserMoves fitting={fitting} onMoved={onMoved} />
      <Pins listings={listings} activeId={activeId} onPick={onPick} />
    </MapContainer>
  );
}

// price pins on an OpenStreetMap base. "Search this area" turns the visible viewport into a filter.
export function MapView({ listings, activeId, onPick, bounds, onSearchArea, onClearArea }) {
  const fitting = useRef(false);
  const [moved, setMoved] = useState(null);
  return (
    <div className="map-wrap">
      <Canvas listings={listings} activeId={activeId} onPick={onPick} fitEnabled={!bounds} fitting={fitting} onMoved={setMoved} />
      <Controls moved={moved} bounds={bounds} onSearchArea={onSearchArea} onClearArea={onClearArea} clearMoved={() => setMoved(null)} />
    </div>
  );
}
