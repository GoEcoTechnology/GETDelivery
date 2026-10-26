'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { patchLeaflet } from '@/lib/leaflet-fix';
import { MapPin, Crosshair, Search, Loader2, Edit2, Check, RefreshCw } from 'lucide-react';

patchLeaflet(L);

function formatNominatimAddress(data: any): string {
  if (!data) return '';
  if (data.address) {
    const a = data.address;
    const primary = a.amenity || a.building || a.shop || a.office || a.leisure || a.tourism;
    const street = a.house_number ? `${a.house_number} ${a.road || ''}`.trim() : (a.road || a.pedestrian || a.path || a.subdivision);
    const area = a.neighbourhood || a.suburb || a.village || a.quarter || a.barangay;
    const city = a.city || a.town || a.municipality;
    const province = a.province || a.state;
    const country = a.country;

    const parts = [primary, street, area, city, province, country].filter(Boolean);
    if (parts.length >= 2) {
      return parts.join(', ');
    }
  }
  return data.display_name || '';
}

interface Props {
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
  initialLandmark?: string;
  onLocationSelect: (location: { lat: number; lng: number; address: string; landmark?: string }) => void;
  height?: string;
}

export default function MapPickerClient({ initialLat, initialLng, initialAddress, initialLandmark, onLocationSelect, height = '300px' }: Props) {
  const [position, setPosition] = useState<[number, number] | null>(
    initialLat && initialLng ? [initialLat, initialLng] : null
  );
  const [address, setAddress] = useState(initialAddress || '');
  const [landmark, setLandmark] = useState(initialLandmark || '');
  const [mounted, setMounted] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [flyToTarget, setFlyToTarget] = useState<[number, number] | null>(null);

  // Search states
  const [searchInput, setSearchInput] = useState('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const onLocationSelectRef = useRef(onLocationSelect);
  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
  }, [onLocationSelect]);

  useEffect(() => {
    if (initialLat !== undefined && initialLng !== undefined) {
      setPosition(prev => {
        if (!prev || prev[0] !== initialLat || prev[1] !== initialLng) {
          return [initialLat, initialLng];
        }
        return prev;
      });
    }
  }, [initialLat, initialLng]);

  useEffect(() => {
    if (initialAddress !== undefined) {
      setAddress(initialAddress);
    }
  }, [initialAddress]);

  useEffect(() => {
    if (initialLandmark !== undefined) {
      setLandmark(initialLandmark);
    }
  }, [initialLandmark]);

  // Reverse geocoding helper that accurately formats and updates location on drag / click
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setIsGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'GETDeliveryApp/1.0 (contact@getdelivery.app)'
          }
        }
      );
      const data = await res.json();
      const resolvedAddress = formatNominatimAddress(data) || data?.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setAddress(resolvedAddress);
      onLocationSelectRef.current({
        lat,
        lng,
        address: resolvedAddress,
        landmark: landmark.trim()
      });
    } catch (err) {
      console.error('Reverse geocoding failed:', err);
      const fallback = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setAddress(fallback);
      onLocationSelectRef.current({
        lat,
        lng,
        address: fallback,
        landmark: landmark.trim()
      });
    } finally {
      setIsGeocoding(false);
    }
  }, [landmark]);

  useEffect(() => {
    if (position && !isGeocoding) {
      onLocationSelectRef.current({
        lat: position[0],
        lng: position[1],
        address: address || `${position[0].toFixed(6)}, ${position[1].toFixed(6)}`,
        landmark: landmark.trim()
      });
    }
  }, [position, address, landmark, isGeocoding]);

  useEffect(() => {
    setMounted(true);
    
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!val.trim()) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    setShowDropdown(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&limit=5&countrycodes=ph`);
        const data = await res.json();
        setPredictions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Nominatim search error:', err);
        setPredictions([]);
      } finally {
        setIsSearching(false);
      }
    }, 600);
  };

  const handleSelectPlace = (place: any) => {
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    setSearchInput(place.display_name);
    setShowDropdown(false);
    setPosition([lat, lng]);
    setFlyToTarget([lat, lng]);
    setAddress(place.display_name);
    onLocationSelectRef.current({
      lat,
      lng,
      address: place.display_name,
      landmark: landmark.trim()
    });
  };

  const handleCurrentLocation = () => {
    setErrorMsg('');
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }
    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPosition([lat, lng]);
        setFlyToTarget([lat, lng]);
        await reverseGeocode(lat, lng);
        setIsLoading(false);
      },
      (err) => {
        setErrorMsg('Unable to retrieve your location. Please check your permissions.');
        setIsLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  // Draggable marker with automatic reverse geocoding on drag
  function DraggableMarker() {
    const markerRef = useRef<L.Marker>(null);
    const eventHandlers = useMemo(
      () => ({
        async dragend() {
          const marker = markerRef.current;
          if (marker != null) {
            const pos = marker.getLatLng();
            setPosition([pos.lat, pos.lng]);
            await reverseGeocode(pos.lat, pos.lng);
          }
        },
      }),
      []
    );

    return position === null ? null : (
      <Marker
        draggable={true}
        eventHandlers={eventHandlers}
        position={position}
        ref={markerRef}
      />
    );
  }

  // Click on map to place/move marker and reverse geocode
  function MapEvents() {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        setPosition([lat, lng]);
        reverseGeocode(lat, lng);
      }
    });
    return null;
  }

  // Smoothly pan/fly map when user searches or clicks current location
  function MapFlyHandler({ target }: { target: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
      if (target) {
        map.flyTo(target, 18, { duration: 1 });
      }
    }, [target, map]);
    return null;
  }

  if (!mounted) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
      
      {!position && (
        <>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>Where is the location?</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              onClick={handleCurrentLocation}
              disabled={isLoading}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#ffffff', border: '1px solid #cbd5e1', padding: '14px', borderRadius: '8px', color: '#0f172a', fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', opacity: isLoading ? 0.7 : 1 }}
            >
              <Crosshair size={18} color="#2563eb" /> Use My Current Location
            </button>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              <div style={{ fontSize: '13px', color: '#64748b' }}>If you cannot find your location, you can place a pin directly.</div>
              <button 
                type="button" 
                onClick={() => {
                  const defaultPos: [number, number] = [12.9744, 124.0055];
                  setPosition(defaultPos);
                  reverseGeocode(defaultPos[0], defaultPos[1]);
                }}
                style={{ background: '#0f172a', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Pick Exact Location on Map
              </button>
            </div>
          </div>

          {errorMsg && (
            <div style={{ padding: '12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '13px', marginTop: '10px', fontWeight: 500 }}>
              {errorMsg}
            </div>
          )}
        </>
      )}

      {position && (
        <>
          {/* Header Display: Current Address & Coordinates */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', background: '#ffffff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flex: 1 }}>
              <MapPin size={20} color="#4f46e5" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                {isEditingAddress ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="Enter or edit address..."
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #4f46e5',
                        fontSize: '13px',
                        fontWeight: 600,
                        outline: 'none',
                        color: '#0f172a'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setIsEditingAddress(false)}
                      style={{
                        padding: '6px 12px',
                        background: '#4f46e5',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Check size={14} /> Done
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', lineHeight: 1.4 }}>
                      {isGeocoding ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4f46e5' }}>
                          <Loader2 size={14} className="animate-spin" /> Locating address from pin...
                        </span>
                      ) : (
                        address || 'Location Coordinates Selected'
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                      Pin coordinates: {position[0].toFixed(5)}, {position[1].toFixed(5)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {!isEditingAddress && (
                <button
                  type="button"
                  onClick={() => setIsEditingAddress(true)}
                  title="Edit address text manually"
                  style={{
                    background: 'transparent',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    color: '#475569',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Edit2 size={12} /> Edit Text
                </button>
              )}

              <button 
                type="button" 
                onClick={() => setPosition(null)}
                style={{ background: 'transparent', border: 'none', color: '#4f46e5', fontSize: '13px', fontWeight: 700, cursor: 'pointer', padding: '4px 6px' }}
              >
                Reset
              </button>
            </div>
          </div>
          
          <div style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', background: '#eff6ff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #dbeafe' }}>
            <span>📍 <strong>Live Pinning:</strong> Drag the marker or click anywhere on the map to pinpoint your exact spot. The address updates automatically.</span>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                <Search size={18} />
              </div>
              <input
                type="text"
                placeholder="Search for a street, landmark, or barangay..."
                value={searchInput}
                onChange={handleSearchChange}
                onFocus={() => { if (predictions.length > 0) setShowDropdown(true); }}
                style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
              />
              {isSearching && (
                <div style={{ position: 'absolute', top: '50%', right: '12px', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              )}
            </div>

            {showDropdown && predictions.length > 0 && (
              <div ref={dropdownRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginTop: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                {predictions.map((p, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectPlace(p)}
                    style={{ padding: '12px', borderBottom: idx === predictions.length - 1 ? 'none' : '1px solid #f1f5f9', cursor: 'pointer', fontSize: '13px', color: '#1e293b' }}
                  >
                    <div style={{ fontWeight: 600 }}>{p.name || p.display_name.split(',')[0]}</div>
                    <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>{p.display_name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Interactive Leaflet Map */}
          <div id="map-picker-container" style={{ width: '100%', height, borderRadius: '12px', overflow: 'hidden', border: '1px solid #cbd5e1', zIndex: 0, position: 'relative' }}>
            <MapContainer center={position} zoom={18} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <DraggableMarker />
              <MapEvents />
              <MapFlyHandler target={flyToTarget} />
            </MapContainer>
          </div>

          {/* Landmark input */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
              Landmark / Delivery Instructions
            </label>
            <input
              type="text"
              placeholder="e.g. Main entrance, Blue gate beside sari-sari store"
              value={landmark}
              onChange={e => setLandmark(e.target.value)}
              style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
        </>
      )}
    </div>
  );
}
