'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default leaflet icons
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  });
}

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const orangeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

interface LocationPoint {
  id: number;
  label: string;
  address: string;
  lat?: number;
  lng?: number;
  landmark?: string;
  color: string;
}

interface Props {
  locations: LocationPoint[];
  onMapPin: (lat: number, lng: number, pointId: number) => void;
  onRouteCalculated?: (data: { distance: string; duration: string; polyline: string }) => void;
}

// Clicking the map sets location on the "next unset" point
function MapClickHandler({ locations, onMapPin }: { locations: LocationPoint[]; onMapPin: Props['onMapPin'] }) {
  useMapEvents({
    click(e) {
      // Find the first location that doesn't have coords yet
      const unset = locations.find(loc => !loc.lat || !loc.lng);
      if (unset) {
        onMapPin(e.latlng.lat, e.latlng.lng, unset.id);
      }
    },
  });
  return null;
}

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || coords.length < 1) return;
    const timeout = setTimeout(() => {
      try {
        if (coords.length === 1) {
          map.setView(coords[0], 15, { animate: true });
        } else {
          map.fitBounds(L.latLngBounds(coords), { padding: [60, 60], animate: true });
        }
      } catch {}
    }, 150);
    return () => clearTimeout(timeout);
  }, [coords.map(c => c.join(',')).join('|'), map]);
  return null;
}

export default function DeliveryRouteMap({ locations, onMapPin, onRouteCalculated }: Props) {
  const [route, setRoute] = useState<[number, number][]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activePointId, setActivePointId] = useState<number | null>(null);
  const onRouteRef = useRef(onRouteCalculated);
  onRouteRef.current = onRouteCalculated;

  useEffect(() => { setMounted(true); }, []);

  const locatedPoints = locations.filter(l => l.lat && l.lng);
  const pickup = locations.find(l => l.label === 'Pickup');
  const dropoffs = locations.filter(l => l.label !== 'Pickup');
  const hasPickup = !!(pickup?.lat && pickup?.lng);
  const primaryDropoff = dropoffs[0];
  const hasPrimaryDropoff = !!(primaryDropoff?.lat && primaryDropoff?.lng);

  // Fetch route between pickup → primary dropoff when both are set
  useEffect(() => {
    if (!hasPickup || !hasPrimaryDropoff) {
      setRoute([]);
      setRouteInfo(null);
      return;
    }
    let cancelled = false;
    async function fetchRoute() {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${pickup!.lng},${pickup!.lat};${primaryDropoff.lng},${primaryDropoff.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled || !data.routes?.length) return;
        const coords: [number, number][] = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
        const distM = data.routes[0].distance;
        const durS = data.routes[0].duration;
        const distStr = distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${Math.round(distM)} m`;
        const durStr = durS >= 3600 ? `${Math.floor(durS / 3600)}h ${Math.floor((durS % 3600) / 60)}m` : `${Math.floor(durS / 60)} min`;
        setRoute(coords);
        setRouteInfo({ distance: distStr, duration: durStr });
        onRouteRef.current?.({ distance: distStr, duration: durStr, polyline: JSON.stringify(coords) });
      } catch {
        setRoute([]);
        setRouteInfo(null);
      }
    }
    fetchRoute();
    return () => { cancelled = true; };
  }, [pickup?.lat, pickup?.lng, primaryDropoff?.lat, primaryDropoff?.lng]);

  const allCoords: [number, number][] = locatedPoints.map(l => [l.lat!, l.lng!]);
  const center: [number, number] = allCoords.length > 0 ? allCoords[0] : [12.9744, 124.0055];

  // Which point will be set next on click
  const nextUnset = locations.find(l => !l.lat || !l.lng);

  if (!mounted) return (
    <div style={{ width: '100%', height: '480px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
      Loading map...
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Hint */}
      {nextUnset && (
        <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#92400e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          👆 Click anywhere on the map to set <strong>{nextUnset.label}</strong>
        </div>
      )}
      {!nextUnset && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          ✅ All locations set! {routeInfo && `Route: ${routeInfo.distance} · ${routeInfo.duration}`}
        </div>
      )}

      {/* Map */}
      <div style={{ width: '100%', height: '480px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', position: 'relative', zIndex: 0 }}>
        <MapContainer center={center} zoom={allCoords.length > 0 ? 13 : 10} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapClickHandler locations={locations} onMapPin={onMapPin} />
          {allCoords.length > 0 && <FitBounds coords={allCoords} />}

          {/* Pickup marker */}
          {hasPickup && (
            <Marker position={[pickup!.lat!, pickup!.lng!]} icon={greenIcon}>
              <Popup>
                <strong style={{ color: '#16a34a' }}>📍 Pickup</strong>
                <br /><span style={{ fontSize: '12px' }}>{pickup!.address}</span>
              </Popup>
            </Marker>
          )}

          {/* Drop-off markers */}
          {dropoffs.map((d, idx) =>
            d.lat && d.lng ? (
              <Marker key={d.id} position={[d.lat, d.lng]} icon={idx === 0 ? redIcon : orangeIcon}>
                <Popup>
                  <strong style={{ color: '#ef4444' }}>📍 {d.label}</strong>
                  <br /><span style={{ fontSize: '12px' }}>{d.address}</span>
                </Popup>
              </Marker>
            ) : null
          )}

          {/* Route polyline */}
          {route.length > 0 && (
            <Polyline positions={route} color="#3b82f6" weight={5} opacity={0.8} />
          )}
        </MapContainer>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '8px 0' }}>
        {locations.map(l => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: l.lat ? '#0f172a' : '#94a3b8' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.lat ? l.color : '#cbd5e1', display: 'inline-block', flexShrink: 0 }} />
            {l.label}: {l.lat ? '✓' : 'not set'}
          </div>
        ))}
      </div>
    </div>
  );
}
