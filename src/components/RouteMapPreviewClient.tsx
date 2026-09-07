'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const dropoffIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || coords.length < 2) return;
    try {
      // Use a small timeout to ensure map is fully rendered
      const timeout = setTimeout(() => {
        if (map && map.getContainer()) {
          map.fitBounds(L.latLngBounds(coords), { padding: [50, 50] });
        }
      }, 100);
      return () => clearTimeout(timeout);
    } catch (error) {
      console.error('Error fitting bounds:', error);
    }
  }, [coords, map]);
  return null;
}

interface Props {
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  onRouteCalculated?: (data: { distance: string; duration: string; polyline: string }) => void;
}

export default function RouteMapPreviewClient({ pickupLat, pickupLng, dropoffLat, dropoffLng, onRouteCalculated }: Props) {
  const [route, setRoute] = useState<[number, number][]>([]);
  const [info, setInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  const onRouteRef = useRef(onRouteCalculated);
  onRouteRef.current = onRouteCalculated;

  // Ensure component is mounted before rendering map (SSR fix)
  useEffect(() => {
    setMounted(true);
  }, []);

  const hasPickup = pickupLat !== undefined && pickupLng !== undefined;
  const hasDropoff = dropoffLat !== undefined && dropoffLng !== undefined;
  const hasBoth = hasPickup && hasDropoff;

  useEffect(() => {
    if (!hasBoth) {
      setRoute([]);
      setInfo(null);
      return;
    }
    let cancelled = false;
    async function fetchRoute() {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled || !data.routes?.length) return;
        const coords: [number, number][] = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
        const distM = data.routes[0].distance;
        const durS = data.routes[0].duration;
        const distStr = distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${Math.round(distM)} m`;
        const durStr = durS >= 3600
          ? `${Math.floor(durS / 3600)}h ${Math.floor((durS % 3600) / 60)}m`
          : `${Math.floor(durS / 60)} min`;
        setRoute(coords);
        setInfo({ distance: distStr, duration: durStr });
        if (onRouteRef.current) {
          onRouteRef.current({ distance: distStr, duration: durStr, polyline: JSON.stringify(coords) });
        }
      } catch {
        setRoute([]);
        setInfo(null);
      }
    }
    fetchRoute();
    return () => { cancelled = true; };
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, hasBoth]);

  if (!hasPickup && !hasDropoff) {
    return (
      <div style={{ width: '100%', height: '300px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '8px' }}>
        <span style={{ fontSize: '32px' }}>🗺️</span>
        <span style={{ fontSize: '14px' }}>Search and select a Pickup and Dropoff to see the route</span>
      </div>
    );
  }

  // Don't render map on server
  if (!mounted) return null;

  const allCoords: [number, number][] = [];
  if (hasPickup) allCoords.push([pickupLat!, pickupLng!]);
  if (route.length) allCoords.push(...route);
  if (hasDropoff) allCoords.push([dropoffLat!, dropoffLng!]);
  const center: [number, number] = hasPickup ? [pickupLat!, pickupLng!] : [dropoffLat!, dropoffLng!];

  return (
    <div>
      {info && (
        <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: '#166534' }}>
            📏 {info.distance}
          </div>
        </div>
      )}
      <div style={{ width: '100%', height: '300px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', zIndex: 0, position: 'relative' }}>
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {hasPickup && (
            <Marker position={[pickupLat!, pickupLng!]} icon={pickupIcon}>
              <Popup><strong>Pickup Location</strong></Popup>
            </Marker>
          )}
          {hasDropoff && (
            <Marker position={[dropoffLat!, dropoffLng!]} icon={dropoffIcon}>
              <Popup><strong>Dropoff</strong></Popup>
            </Marker>
          )}
          {route.length > 0 && (
            <Polyline positions={route} color="#3b82f6" weight={5} opacity={0.8} />
          )}
          {allCoords.length >= 2 && <FitBounds coords={allCoords} />}
        </MapContainer>
      </div>
    </div>
  );
}
