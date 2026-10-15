import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';

const icon = L.divIcon({ className: 'pin-wrap', html: '<span class="pin active">⌂</span>', iconSize: [34, 26], iconAnchor: [17, 13] });

// Small non-interactive map for the detail page (click-drag disabled so it doesn't hijack page scroll).
export function LocationMap({ listing }) {
  return (
    <MapContainer center={[listing.lat, listing.lng]} zoom={14} className="mini-map" scrollWheelZoom={false} dragging={false} zoomControl={false} aria-label={`Map of ${listing.address}`}>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[listing.lat, listing.lng]} icon={icon} />
    </MapContainer>
  );
}
