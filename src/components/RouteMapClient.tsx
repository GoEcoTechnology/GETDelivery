'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import type { CustomerStop } from './RouteMap';

if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  });
}

const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const currentLocationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

// Numbered Marker Icon Generator
function getNumberedIcon(number: number) {
  return L.divIcon({
    className: 'numbered-marker',
    html: `<div style="background-color: #10b981; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${number}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || coords.length < 2) return;
    try {
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
  pickupLat?: number;
  pickupLng?: number;
  customerStops: CustomerStop[];
  showCurrentLocation?: boolean;
}

export default function RouteMapClient({
  pickupAddress,
  pickupLat, 
  pickupLng,
  customerStops = [],
  showCurrentLocation = false
}: Props) {
  const [resolvedPickup, setResolvedPickup] = useState<[number, number] | null>(null);
  const [resolvedStops, setResolvedStops] = useState<{stop: CustomerStop, coords: [number, number]}[]>([]);
  const [routeLine, setRouteLine] = useState<[number, number][]>([]);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Geolocation Tracking
  useEffect(() => {
    if (!showCurrentLocation || !navigator.geolocation) return;
    
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentLocation([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => console.warn('Geolocation error:', err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
    
    return () => navigator.geolocation.clearWatch(watchId);
  }, [showCurrentLocation]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);

      // Resolve Pickup
      let pCoords: [number, number] | null = null;
      if (pickupLat && pickupLng) {
        pCoords = [pickupLat, pickupLng];
      } else if (!pickupAddress.includes('Business Location')) {
        pCoords = await geocodeAddress(pickupAddress);
      }
      
      // Resolve Drops
      const resolved: {stop: CustomerStop, coords: [number, number]}[] = [];
      let anyResolved = false;

      for (const stop of (customerStops || [])) {
        let dCoords: [number, number] | null = null;
        if (stop.lat && stop.lng) {
          dCoords = [stop.lat, stop.lng];
        } else {
          dCoords = await geocodeAddress(stop.address);
        }
        
        if (dCoords) {
          resolved.push({ stop, coords: dCoords });
          anyResolved = true;
        }
      }

      if (resolved.length === 0) {
        setError('Could not locate any dropoff addresses on the map.');
        setLoading(false);
        return;
      }

      // Fallback for pickup if unresolved
      if (!pCoords && anyResolved) {
        pCoords = [resolved[0].coords[0] + 0.01, resolved[0].coords[1] + 0.01];
      }

      setResolvedPickup(pCoords);
      setResolvedStops(resolved);

      if (pCoords) {
        await fetchMultiRoute(pCoords, resolved.map(r => r.coords));
      }
      setLoading(false);
    }

    init();
  }, [pickupLat, pickupLng, pickupAddress, customerStops]);

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

  async function fetchMultiRoute(pickup: [number, number], drops: [number, number][]) {
    try {
      // OSRM format: lon,lat;lon,lat...
      const waypoints = [pickup, ...drops].map(c => `${c[1]},${c[0]}`).join(';');
      
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`);
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

  if (!mounted || !resolvedPickup) return null;

  const allCoords: [number, number][] = [resolvedPickup, ...resolvedStops.map(r => r.coords)];
  if (currentLocation) allCoords.push(currentLocation);

  // Generate a key from the resolved coordinates so MapContainer fully recreates if pickup changes
  const mapKey = `map-${resolvedPickup[0]}-${resolvedPickup[1]}`;

  return (
    <div style={{ width: '100%', height: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', zIndex: 0, position: 'relative' }}>
      <MapContainer key={mapKey} center={resolvedPickup} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Current Location */}
        {currentLocation && (
          <Marker position={currentLocation} icon={currentLocationIcon}>
            <Popup><strong>You are here</strong></Popup>
          </Marker>
        )}

        {/* Pickup */}
        <Marker position={resolvedPickup} icon={pickupIcon}>
          <Popup><strong>Pickup Location</strong><br />{pickupAddress}</Popup>
        </Marker>

        {/* Dropoffs */}
        {resolvedStops.map((drop, idx) => (
          <Marker key={drop.stop.id} position={drop.coords} icon={getNumberedIcon(drop.stop.stopNumber)}>
            <Popup>
              <strong>Stop {drop.stop.stopNumber}</strong><br/>
              {drop.stop.customerName && <div>{drop.stop.customerName}</div>}
              {drop.stop.address}
            </Popup>
          </Marker>
        ))}

        {/* Route Line */}
        {routeLine.length > 0 && (
          <Polyline positions={routeLine} color="#3b82f6" weight={5} opacity={0.8} lineCap="round" lineJoin="round" />
        )}

        <FitBounds coords={allCoords} />
      </MapContainer>
    </div>
  );
}
