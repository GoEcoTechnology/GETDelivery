'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Crosshair, Search, Loader2 } from 'lucide-react';

// Fix leaflet icon issue
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  });
}

// Generate a simple UUID-like string for session token
const generateSessionToken = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

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
  
  // Google Places Autocomplete States
  const [searchInput, setSearchInput] = useState('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [sessionToken, setSessionToken] = useState<string>('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [manualMode, setManualMode] = useState(false);

  // Use this key to force React to unmount and remount the MapContainer if needed
  // This prevents the _leaflet_pos error when switching views rapidly
  const mapKey = useMemo(() => position ? `map-${position[0]}-${position[1]}` : 'map-default', [position]);

  const onLocationSelectRef = useRef(onLocationSelect);
  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
  }, [onLocationSelect]);

  useEffect(() => {
    if (position) {
      onLocationSelectRef.current({
        lat: position[0],
        lng: position[1],
        address: address || `${position[0].toFixed(6)}, ${position[1].toFixed(6)}`,
        landmark: landmark.trim()
      });
    }
  }, [position, address, landmark]);

  useEffect(() => {
    setMounted(true);
    setSessionToken(generateSessionToken());
    
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      const container = L.DomUtil.get('map-picker-container');
      if (container) {
        (container as any)._leaflet_id = null;
      }
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
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(val)}&sessionToken=${sessionToken}`);
        const data = await res.json();
        if (data.suggestions) {
          setPredictions(data.suggestions.map((s: any) => s.placePrediction));
        } else {
          setPredictions([]);
        }
      } catch (err) {
        console.error('Autocomplete error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 400); // 400ms debounce
  };

  const handleSelectPlace = async (placeId: string, description: string) => {
    setSearchInput(description);
    setShowDropdown(false);
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/places/details?placeId=${placeId}&sessionToken=${sessionToken}`);
      const data = await res.json();
      
      if (data.location) {
        setPosition([data.location.latitude, data.location.longitude]);
        setAddress(data.formattedAddress || data.displayName?.text || description);
        setSessionToken(generateSessionToken()); // Reset token for next session
      } else {
        setErrorMsg('Failed to get location details for this place.');
      }
    } catch (err) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
        
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
            headers: {
              'User-Agent': 'GETDeliveryApp/1.0 (contact@getdelivery.app)'
            }
          });
          const data = await res.json();
          if (data && data.display_name) {
            setAddress(data.display_name);
          } else {
            setAddress('My Current Location');
          }
        } catch (err) {
          console.error('Reverse geocoding failed:', err);
          setAddress('My Current Location');
        }
        
        setIsLoading(false);
      },
      (err) => {
        setErrorMsg('Unable to retrieve your location. Please check your permissions.');
        setIsLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  function DraggableMarker() {
    const markerRef = useRef<L.Marker>(null);
    const eventHandlers = useMemo(
      () => ({
        async dragend() {
          const marker = markerRef.current;
          if (marker != null) {
            const pos = marker.getLatLng();
            setPosition([pos.lat, pos.lng]);
            
            // Only reverse-geocode if there is no address or it's just coordinates.
            // This prevents overwriting a valid address typed by the user with OSM's often incorrect data.
            if (!address || /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(address.trim())) {
              setAddress('Updating address...');
              try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}`, {
                  headers: {
                    'User-Agent': 'GETDeliveryApp/1.0 (contact@getdelivery.app)'
                  }
                });
                const data = await res.json();
                if (data && data.display_name) {
                  setAddress(data.display_name);
                } else {
                  setAddress(`${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`);
                }
              } catch (err) {
                console.error('Reverse geocoding failed:', err);
                setAddress(`${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`);
              }
            }
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

  function MapUpdater({ center }: { center: [number, number] }) {
    const map = useMapEvents({});
    useEffect(() => {
      if (center) {
        map.setView(center, 18, { animate: false });
      }
    }, [center, map]);
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
            
            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>OR</div>
            
            <button
              type="button"
              onClick={() => setManualMode(!manualMode)}
              style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Pick Exact Location on Map
            </button>
          </div>

          {manualMode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              <div style={{ fontSize: '13px', color: '#64748b' }}>If you cannot find your location, you can place a pin directly.</div>
              <button 
                type="button" 
                onClick={() => setPosition([12.9744, 124.0055])} // Default fallback to Sorsogon area
                style={{ background: '#0f172a', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Open Map to Drop Pin
              </button>
            </div>
          )}

          {errorMsg && (
            <div style={{ padding: '12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '13px', marginTop: '10px', fontWeight: 500 }}>
              {errorMsg}
            </div>
          )}
        </>
      )}

      {position && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
              {address && address !== `${position[0].toFixed(6)}, ${position[1].toFixed(6)}` ? address : 'Selected Location'}
            </div>
            <button 
              type="button" 
              onClick={() => setPosition(null)}
              style={{ background: 'transparent', border: 'none', color: '#4f46e5', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
            >
              Change Location
            </button>
          </div>
          
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '-8px' }}>
            Verify the location. You can drag the marker to adjust exactly where the pin drops.
          </div>

          <div id="map-picker-container" style={{ width: '100%', height, borderRadius: '12px', overflow: 'hidden', border: '1px solid #cbd5e1', zIndex: 0, position: 'relative' }}>
            <MapContainer key={mapKey} center={position} zoom={18} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <DraggableMarker />
              <MapUpdater center={position} />
            </MapContainer>
          </div>



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
