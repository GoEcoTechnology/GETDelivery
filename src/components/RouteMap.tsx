'use client';
import dynamic from 'next/dynamic';

const RouteMapClient = dynamic(() => import('./RouteMapClient'), {
  ssr: false,
  loading: () => <div style={{ width: '100%', height: '300px', backgroundColor: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Loading map...</div>
});

interface Props {
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  routePolyline?: string;
}

export default function RouteMap(props: Props) {
  return <RouteMapClient {...props} />;
}
