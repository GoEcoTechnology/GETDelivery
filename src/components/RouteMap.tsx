'use client';
import dynamic from 'next/dynamic';

const RouteMapClient = dynamic(() => import('./RouteMapClient'), {
  ssr: false,
  loading: () => <div style={{ width: '100%', height: '300px', backgroundColor: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Loading map...</div>
});

export interface CustomerStop {
  id: string | number;
  stopNumber: number;
  address: string;
  lat?: number;
  lng?: number;
  customerName?: string;
  contactNumber?: string;
}

interface Props {
  pickupAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  customerStops: CustomerStop[];
  showCurrentLocation?: boolean;
}

export default function RouteMap(props: Props) {
  return <RouteMapClient {...props} />;
}
