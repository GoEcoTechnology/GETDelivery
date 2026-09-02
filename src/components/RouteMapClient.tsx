'use client';

import { useEffect, useState } from 'react';
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
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
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
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  routePolyline?: string;
}

export default function RouteMapClient({
  pickupAddress, dropoffAddress,
  pickupLat, pickupLng, dropoffLat, dropoffLng,
  routePolyline
}: Props) {
  const [resolvedPickup, setResolvedPickup] = useState<[number, number] | null>(null);
  const [resolvedDropoff, setResolvedDropoff] = useState<[number, number] | null>(null);
  const [routeLine, setRouteLine] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted before rendering map (SSR fix)
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);

      // --- Strategy 1: Use saved coordinates directly (fast, no API needed) ---
      if (pickupLat && pickupLng && dropoffLat && dropoffLng) {
        setResolvedPickup([pickupLat, pickupLng]);
        setResolvedDropoff([dropoffLat, dropoffLng]);

        // Use saved polyline if available, otherwise fetch route
        if (routePolyline) {
          try {
            const parsed = JSON.parse(routePolyline) as [number, number][];
            setRouteLine(parsed);
          } catch {
            // If polyline parse fails, fall through to fetch
            await fetchRoute(pickupLat, pickupLng, dropoffLat, dropoffLng);
          }
        } else {
          await fetchRoute(pickupLat, pickupLng, dropoffLat, dropoffLng);
        }
        setLoading(false);
        return;
      }

      // --- Strategy 2: Geocode the text addresses (fallback) ---
      const [pCoords, dCoords] = await Promise.all([
        geocodeAddress(pickupAddress),
        geocodeAddress(dropoffAddress),
      ]);

      if (!pCoords || !dCoords) {
        setError('Could not locate one or both addresses on the map. Please ensure the addresses are valid.');
        setLoading(false);
        return;
      }

      setResolvedPickup(pCoords);
      setResolvedDropoff(dCoords);
      await fetchRoute(pCoords[0], pCoords[1], dCoords[0], dCoords[1]);
      setLoading(false);
    }

    init();
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, routePolyline, pickupAddress, dropoffAddress]);

  async function geocodeAddress(address: string): Promise<[number, number] | null> {
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`);
      const data = await res.json();
      if (data?.features?.length > 0) {
        const [lng, lat] = data.features[0].geometry.coordinates;
        return [lat, lng];
      }
      return null;
    } catch { return null; }
  }

  async function fetchRoute(pLat: number, pLng: number, dLat: number, dLng: number) {
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${dLng},${dLat}?overview=full&geometries=geojson`);
      const data = await res.json();
      if (data.routes?.length > 0) {
        const coords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]);
        setRouteLine(coords);
      }
    } catch { /* silent fail - still show pins */ }
  }

  if (loading) {
    return <div style={{ width: '100%', height: '300px', backgroundColor: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Loading map...</div>;
  }

  if (error) {
    return <div style={{ width: '100%', height: '300px', backgroundColor: '#fef2f2', border: '1px solid #f87171', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b91c1c', padding: '20px', textAlign: 'center' }}>{error}</div>;
  }

  if (!mounted || !resolvedPickup || !resolvedDropoff) return null;

  const allCoords: [number, number][] = [resolvedPickup, ...routeLine, resolvedDropoff];

  return (
    <div style={{ width: '100%', height: '350px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', zIndex: 0, position: 'relative' }}>
      <MapContainer center={resolvedPickup} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={resolvedPickup} icon={pickupIcon}>
          <Popup><strong>Pickup Location</strong><br />{pickupAddress}</Popup>
        </Marker>
        <Marker position={resolvedDropoff} icon={dropoffIcon}>
          <Popup><strong>Destination</strong><br />{dropoffAddress}</Popup>
        </Marker>
        {routeLine.length > 0 && (
          <Polyline positions={routeLine} color="#3b82f6" weight={5} opacity={0.8} lineCap="round" lineJoin="round" />
        )}
        <FitBounds coords={allCoords} />
      </MapContainer>
    </div>
  );
}
