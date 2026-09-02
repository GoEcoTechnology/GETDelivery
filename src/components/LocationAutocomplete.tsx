'use client';

import { useState, useEffect, useRef } from 'react';

interface Suggestion {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface Props {
  label: string;
  placeholder?: string;
  value: string;
  onSelect: (result: { address: string; lat: number; lng: number }) => void;
  required?: boolean;
}

const PHILIPPINES_BBOX = {
  minLon: 116.93,
  minLat: 4.6,
  maxLon: 127.27,
  maxLat: 21.13,
};

export default function LocationAutocomplete({ label, placeholder, value, onSelect, required }: Props) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = async (q: string) => {
    if (!q || q.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&bbox=${PHILIPPINES_BBOX.minLon},${PHILIPPINES_BBOX.minLat},${PHILIPPINES_BBOX.maxLon},${PHILIPPINES_BBOX.maxLat}`
      );
      const data = await res.json();
      const results: Suggestion[] = (data.features || [])
        .map((f: any) => {
          const p = f.properties || {};
          const lon = Number(f.geometry?.coordinates?.[0]);
          const lat = Number(f.geometry?.coordinates?.[1]);
          const countryName = String(p.country || '').toLowerCase();

          if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
          if (
            lat < PHILIPPINES_BBOX.minLat ||
            lat > PHILIPPINES_BBOX.maxLat ||
            lon < PHILIPPINES_BBOX.minLon ||
            lon > PHILIPPINES_BBOX.maxLon
          ) {
            return null;
          }

          const parts = [p.name, p.street, p.housenumber, p.district, p.city, p.state, p.country]
            .filter(Boolean);
          const address = [...new Set(parts)].join(', ');

          if (countryName && countryName !== 'philippines' && countryName !== 'pilipinas') {
            return null;
          }

          return {
            name: p.name || address,
            address,
            lat,
            lng: lon,
          };
        })
        .filter(Boolean) as Suggestion[];

      setSuggestions(results);
      setIsOpen(results.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 350);
  };

  const handleSelect = (s: Suggestion) => {
    setQuery(s.address);
    setIsOpen(false);
    setSuggestions([]);
    onSelect({ address: s.address, lat: s.lat, lng: s.lng });
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <label style={labelStyle}>{label}{required && ' *'}</label>
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...inputStyle, paddingLeft: '36px' }}
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder || 'Search location...'}
          required={required}
          autoComplete="off"
        />
        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', pointerEvents: 'none' }}>
          📍
        </span>
        {loading && (
          <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#94a3b8' }}>
            ...
          </span>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 9999,
          maxHeight: '240px',
          overflowY: 'auto',
          marginTop: '4px',
        }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onClick={() => handleSelect(s)}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                borderBottom: i < suggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                transition: 'background 0.1s',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = 'white')}
            >
              <span style={{ fontSize: '14px', marginTop: '1px', flexShrink: 0 }}>📍</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '1px' }}>{s.name}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{s.address}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: '4px', fontSize: '12px',
  fontWeight: 600, color: '#64748b', textTransform: 'uppercase'
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px', borderRadius: '6px',
  border: '1px solid #cbd5e1', fontSize: '14px', background: 'white', boxSizing: 'border-box'
};
