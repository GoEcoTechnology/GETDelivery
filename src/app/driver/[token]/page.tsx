'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { MapPin, Box, CheckCircle2, Navigation, Upload, Phone, FileText } from 'lucide-react';

export default function DriverPage() {
  const params = useParams();
  const token = params.token as string;
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchDeliveryData = async () => {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join('')));
        
        const assignmentId = payload.assignmentId;

        const res = await fetch(`/api/driver/${assignmentId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const result = await res.json();
        if (res.ok) {
          setData(result.data);
        } else {
          setError(result.error || 'Failed to load delivery');
        }
      } catch (err) {
        setError('Network error or invalid token');
      } finally {
        setLoading(false);
      }
    };
    fetchDeliveryData();
  }, [token]);

  const updateStatus = async (newStatus: string) => {
    try {
      setUpdating(true);
      const base64Url = token.split('.')[1];
      const payload = JSON.parse(atob(base64Url.replace(/-/g, '+').replace(/_/g, '/')));
      const assignmentId = payload.assignmentId;

      const res = await fetch(`/api/driver/${assignmentId}/status`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      const result = await res.json();
      if (res.ok) {
        alert(`Status updated to ${newStatus.replace(/_/g, ' ')}!`);
        window.location.reload();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setUpdating(false);
    }
  };

  const uploadProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    try {
      setUpdating(true);
      const base64Url = token.split('.')[1];
      const payload = JSON.parse(atob(base64Url.replace(/-/g, '+').replace(/_/g, '/')));
      const assignmentId = payload.assignmentId;

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/driver/${assignmentId}/proof`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const result = await res.json();
      if (res.ok) {
        alert('Proof uploaded successfully!');
        updateStatus('DELIVERED');
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return (
    <div style={fullScreenCenter}>
      <div style={pulseCircle}></div>
      <p style={{ color: '#64748b', fontWeight: 500, marginTop: '16px' }}>Loading manifest...</p>
    </div>
  );

  if (error) return (
    <div style={fullScreenCenter}>
      <div style={cardStyle}>
        <h2 style={{ color: '#ef4444', margin: '0 0 16px 0' }}>Access Denied</h2>
        <p style={{ color: '#64748b' }}>{error}</p>
      </div>
    </div>
  );

  if (data.status === 'DELIVERED') {
    return (
      <div style={fullScreenCenter}>
        <div style={cardStyle}>
          <div style={{...iconCircle, backgroundColor: '#dcfce7', color: '#16a34a'}}>
            <CheckCircle2 size={40} />
          </div>
          <h2 style={{ margin: '0 0 12px 0', color: '#0f172a' }}>Delivery Complete!</h2>
          <p style={{ color: '#64748b' }}>Thank you for your service.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', paddingBottom: '32px', fontFamily: 'Inter, sans-serif' }}>
      
      <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: '32px 24px 64px 24px', color: 'white', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '8px' }}>
              Manifest #{data.orderId}
            </div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Driver Portal</h1>
          </div>
          <div style={{ padding: '6px 12px', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '20px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' }}>
            {data.status.replace(/_/g, ' ')}
          </div>
        </div>
      </div>
      
      <div style={{ marginTop: '-40px', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Customer Info Card */}
        <div style={contentCard}>
          <h3 style={cardHeader}><FileText size={16} /> Customer Details</h3>
          <div style={{ fontWeight: 700, fontSize: '18px', color: '#0f172a', marginBottom: '8px' }}>{data.customerName}</div>
          {data.customerContact && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4f46e5', fontWeight: 600, fontSize: '15px' }}>
              <Phone size={16} /> <a href={`tel:${data.customerContact}`} style={{ color: 'inherit', textDecoration: 'none' }}>{data.customerContact}</a>
            </div>
          )}
          {data.instructions && (
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '8px', fontSize: '13px', fontWeight: 500 }}>
              <strong>Note:</strong> {data.instructions}
            </div>
          )}
        </div>

        {/* Route Card */}
        <div style={contentCard}>
          <h3 style={cardHeader}><Navigation size={16} /> Delivery Route</h3>
          <div style={{ position: 'relative', paddingLeft: '24px' }}>
            <div style={{ position: 'absolute', left: '7px', top: '10px', bottom: '10px', width: '2px', backgroundColor: '#e2e8f0' }}></div>
            
            <div style={{ position: 'relative', marginBottom: '24px' }}>
              <div style={{ position: 'absolute', left: '-22px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#4f46e5', border: '2px solid white', boxShadow: '0 0 0 1px #cbd5e1' }}></div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Pickup</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>{data.pickupAddress}</div>
            </div>
            
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '-22px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981', border: '2px solid white', boxShadow: '0 0 0 1px #cbd5e1' }}></div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Drop-off</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>{data.dropoffAddress}</div>
            </div>
          </div>
        </div>

        {/* Items Card */}
        <div style={contentCard}>
          <h3 style={cardHeader}><Box size={16} /> Items to Deliver</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.items.map((item: any) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 600, color: '#334155', fontSize: '14px' }}>{item.productName}</div>
                <div style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, color: '#475569' }}>
                  {item.quantity} {item.unit || 'pcs'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions Card */}
        <div style={contentCard}>
          <h3 style={cardHeader}>Action Center</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: data.status === 'ARRIVED_AT_DESTINATION' ? '32px' : '0' }}>
            {data.status === 'ASSIGNED' && (
              <button onClick={() => updateStatus('ARRIVING_AT_PICKUP')} disabled={updating} style={actionBtn('#4f46e5')}>
                Start Journey to Pickup
              </button>
            )}
            {data.status === 'ARRIVING_AT_PICKUP' && (
              <button onClick={() => updateStatus('ARRIVED_AT_PICKUP')} disabled={updating} style={actionBtn('#4f46e5')}>
                I'm at the Pickup Location
              </button>
            )}
            {data.status === 'ARRIVED_AT_PICKUP' && (
              <button onClick={() => updateStatus('PICKED_UP')} disabled={updating} style={actionBtn('#8b5cf6')}>
                Confirm Pickup (Stock Out)
              </button>
            )}
            {data.status === 'PICKED_UP' && (
              <button onClick={() => updateStatus('IN_TRANSIT')} disabled={updating} style={actionBtn('#f59e0b')}>
                Start Journey to Drop-off
              </button>
            )}
            {data.status === 'IN_TRANSIT' && (
              <button onClick={() => updateStatus('ARRIVED_AT_DESTINATION')} disabled={updating} style={actionBtn('#f59e0b')}>
                I'm at the Destination
              </button>
            )}
          </div>

          {data.status === 'ARRIVED_AT_DESTINATION' && (
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '16px' }}>Upload Proof of Delivery (PoD)</div>
              <form onSubmit={uploadProof}>
                <div style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '16px', textAlign: 'center', marginBottom: '16px', backgroundColor: '#f8fafc' }}>
                  <Upload size={24} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                  <input 
                    type="file" 
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    style={{ width: '100%', fontSize: '13px', color: '#475569' }}
                  />
                </div>
                <button type="submit" disabled={!file || updating} style={{...actionBtn('#10b981'), opacity: (!file || updating) ? 0.5 : 1}}>
                  Complete Delivery
                </button>
              </form>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

const fullScreenCenter = { minHeight: '100vh', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'Inter, sans-serif', padding: '24px' };
const pulseCircle = { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#4f46e5', animation: 'pulse 1.5s infinite ease-in-out' };
const cardStyle = { backgroundColor: 'white', padding: '40px 32px', borderRadius: '16px', textAlign: 'center' as const, boxShadow: '0 10px 25px rgba(0,0,0,0.05)', maxWidth: '400px', width: '100%' };
const iconCircle = { width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const contentCard = { backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' };
const cardHeader = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 16px 0', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' };

const actionBtn = (color: string) => ({
  width: '100%',
  padding: '16px',
  backgroundColor: color,
  color: 'white',
  border: 'none',
  borderRadius: '12px',
  fontSize: '15px',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: `0 4px 12px ${color}40`,
  transition: 'transform 0.1s'
});
