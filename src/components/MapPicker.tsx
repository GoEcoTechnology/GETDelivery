'use client';
import dynamic from 'next/dynamic';

const MapPickerClient = dynamic(() => import('./MapPickerClient'), {
  ssr: false,
  loading: () => <div style={{ width: '100%', height: '300px', backgroundColor: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Loading map...</div>
});

interface Props {
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
  initialLandmark?: string;
  onLocationSelect: (location: { lat: number; lng: number; address: string; landmark?: string }) => void;
  height?: string;
}

export default function MapPicker(props: Props) {
  return <MapPickerClient {...props} />;
}
