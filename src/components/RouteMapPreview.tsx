'use client';
import dynamic from 'next/dynamic';

const RouteMapPreviewClient = dynamic(() => import('./RouteMapPreviewClient'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '300px', background: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '14px' }}>
      Select pickup and dropoff to see route
    </div>
  ),
});

interface Props {
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  onRouteCalculated?: (data: { distance: string; duration: string; polyline: string }) => void;
}

export default function RouteMapPreview(props: Props) {
  return <RouteMapPreviewClient {...props} />;
}
