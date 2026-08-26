'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Package, MapPin, Truck, CheckCircle2, AlertCircle } from 'lucide-react';

export default function InvitePage() {
  const params = useParams();
  const token = params.token as string;
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [driverName, setDriverName] = useState('');
  const [vehicleDetails, setVehicleDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successLink, setSuccessLink] = useState<string | null>(null);

  useEffect(() => {
    const validateToken = async () => {
      try {
        const res = await fetch(`/api/invite/${token}`);
        const result = await res.json();
        
        if (res.ok) {
          setData(result.data);
        } else {
          setError(result.error || 'Invalid token');
        }
      } catch (err) {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    validateToken();
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName || !vehicleDetails) return;
    
    setSubmitting(true);
    try {
      const res = await fetch(`/api/invite/${token}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverName, vehicleDetails })
      });
      const result = await res.json();
      
      if (res.ok) {
        setSuccessLink(result.driverAccessLink);
      } else {
        alert(`Failed to accept: ${result.error}`);
        window.location.reload();
      }
    } catch (err) {
      alert('Network error while assigning');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={fullScreenCenter}>
      <div style={pulseCircle}></div>
      <p style={{ color: '#64748b', fontWeight: 500, marginTop: '16px' }}>Securing connection...</p>
    </div>
  );
  
  if (error) {
    return (
      <div style={fullScreenCenter}>
        <div style={cardStyle}>
          <div style={{...iconCircle, backgroundColor: '#fee2e2', color: '#dc2626'}}>
            <AlertCircle size={32} />
          </div>
          <h2 style={titleStyle}>Link Expired</h2>
          <p style={descStyle}>{error}</p>
          <p style={{...descStyle, fontSize: '13px', marginTop: '16px'}}>This opportunity may have been claimed by another partner.</p>
        </div>
      </div>
    );
  }

  if (successLink) {
    return (
      <div style={fullScreenCenter}>
        <div style={cardStyle}>
          <div style={{...iconCircle, backgroundColor: '#dcfce7', color: '#16a34a'}}>
            <CheckCircle2 size={32} />
          </div>
          <h2 style={titleStyle}>Delivery Secured!</h2>
          <p style={descStyle}>Please share this secure access link with your driver.</p>
          
          <div style={{ margin: '24px 0', padding: '16px', backgroundColor: '#f1f5f9', borderRadius: '8px', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '13px', color: '#475569', border: '1px solid #e2e8f0' }}>
            {successLink}
          </div>
          
          <button 
            onClick={() => {
              navigator.clipboard.writeText(successLink);
              alert('Copied to clipboard!');
            }}
            style={btnPrimaryStyle}
          >
            Copy Link for Driver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ ...cardStyle, maxWidth: '500px', width: '100%', padding: 0, overflow: 'hidden' }}>
        
        <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: '32px 24px', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Package size={20} color="#818cf8" />
            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: '#94a3b8', textTransform: 'uppercase' }}>
              Delivery Dispatch
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800 }}>Order #{data.deliveryId}</h1>
        </div>
        
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ marginTop: '2px', color: '#4f46e5' }}><MapPin size={20} /></div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Pickup Location</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>{data.pickupAddress}</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ marginTop: '2px', color: '#10b981' }}><MapPin size={20} /></div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Drop-off Location</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>{data.deliveryAddress}</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '24px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Truck size={18} color="#475569" />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>Accept & Assign</h3>
            </div>
            
            <form onSubmit={handleAccept}>
              <div style={{ marginBottom: '16px' }}>
                <input 
                  type="text" 
                  value={driverName}
                  onChange={e => setDriverName(e.target.value)}
                  required
                  placeholder="Driver Full Name"
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <input 
                  type="text" 
                  value={vehicleDetails}
                  onChange={e => setVehicleDetails(e.target.value)}
                  required
                  placeholder="Vehicle Details (e.g. L300 Van ABC-1234)"
                  style={inputStyle}
                />
              </div>
              <button 
                type="submit" 
                disabled={submitting || !driverName || !vehicleDetails}
                style={{ ...btnPrimaryStyle, opacity: (submitting || !driverName || !vehicleDetails) ? 0.7 : 1, cursor: (submitting || !driverName || !vehicleDetails) ? 'not-allowed' : 'pointer' }}
              >
                {submitting ? 'Securing Assignment...' : 'Confirm Assignment'}
              </button>
            </form>
          </div>
        </div>
        
      </div>
    </div>
  );
}

// Reusable Styles
const fullScreenCenter = { minHeight: '100vh', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', fontFamily: 'Inter, sans-serif', padding: '24px' };
const cardStyle = { backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(16px)', padding: '40px 32px', borderRadius: '16px', textAlign: 'center' as const, boxShadow: '0 10px 25px rgba(0,0,0,0.05)', maxWidth: '400px', width: '100%', border: '1px solid rgba(255,255,255,0.5)' };
const iconCircle = { width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const titleStyle = { margin: '0 0 12px 0', fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' };
const descStyle = { margin: 0, color: '#64748b', fontSize: '15px', lineHeight: '1.5' };
const btnPrimaryStyle = { width: '100%', padding: '14px', background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)', transition: 'all 0.2s' };
const inputStyle = { width: '100%', padding: '14px 16px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '14px', background: 'white', outline: 'none', transition: 'border-color 0.2s' };
const pulseCircle = { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#3b82f6', animation: 'pulse 1.5s infinite ease-in-out' };
