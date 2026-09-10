'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';

type ApiError = {
  error?: string;
};

export default function PartnerOrderActions({ orderId, status }: { orderId: number; status: string }) {
  const router = useRouter();
  // localStatus allows immediate UI update after accept without waiting for router.refresh()
  const [localStatus, setLocalStatus] = useState(status);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [declineReason, setDeclineReason] = useState('Too far');
  const [cancelReason, setCancelReason] = useState('Vehicle breakdown');
  const [otherReason, setOtherReason] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverContact, setDriverContact] = useState('');

  const declineReasons = ['Too far', 'Vehicle unavailable', 'Personal emergency', 'Already handling another delivery', 'Other'];
  const cancelReasons = ['Vehicle breakdown', 'Personal emergency', 'Package too large', 'Accident', 'Other'];

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const res = await fetch(`/api/partner/orders/${orderId}/accept`, { method: 'POST' });
      const data = (await res.json()) as ApiError;
      if (!res.ok) throw new Error(data.error || 'Failed to accept');
      // Immediately update local state so button stays "Accepted" without flicker
      setLocalStatus('ACCEPTED');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert(`Error: ${message}`);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDeclineSubmit = async () => {
    const finalReason = declineReason === 'Other' ? otherReason : declineReason;
    if (!finalReason) return alert('Please provide a reason');
    setIsDeclining(true);
    try {
      const res = await fetch(`/api/partner/orders/${orderId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ declineReason: finalReason }),
      });
      const data = (await res.json()) as ApiError;
      if (!res.ok) throw new Error(data.error || 'Failed to decline');
      setShowDeclineModal(false);
      setLocalStatus('DECLINED');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert(`Error: ${message}`);
    } finally {
      setIsDeclining(false);
    }
  };

  const handleCancelSubmit = async () => {
    const finalReason = cancelReason === 'Other' ? otherReason : cancelReason;
    if (!finalReason) return alert('Please provide a reason');
    if (!confirm('Are you sure you want to cancel this delivery assignment? The business owner will be notified and this action cannot be undone.')) return;
    
    setIsDeclining(true);
    try {
      const res = await fetch(`/api/partner/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelReason: finalReason }),
      });
      const data = (await res.json()) as ApiError;
      if (!res.ok) throw new Error(data.error || 'Failed to cancel');
      setShowCancelModal(false);
      setLocalStatus('CANCELLED');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert(`Error: ${message}`);
    } finally {
      setIsDeclining(false);
    }
  };

  const handleStartSubmit = async () => {
    if (!driverName.trim() || !driverContact.trim()) {
      alert('Please provide both the driver name and contact number.');
      return;
    }
    
    setIsStarting(true);
    try {
      const res = await fetch(`/api/partner/orders/${orderId}/start`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverName, driverContact })
      });
      const data = (await res.json()) as ApiError;
      if (!res.ok) throw new Error(data.error || 'Failed to start delivery');
      setShowStartModal(false);
      setLocalStatus('IN_TRANSIT');
      router.refresh();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsStarting(false);
    }
  };

  const handleCompleteSubmit = async () => {
    setIsCompleting(true);
    try {
      const res = await fetch(`/api/partner/orders/${orderId}/complete`, { method: 'POST' });
      const data = (await res.json()) as ApiError;
      if (!res.ok) throw new Error(data.error || 'Failed to complete delivery');
      setShowCompleteModal(false);
      setLocalStatus('DELIVERED');
      router.refresh();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsCompleting(false);
    }
  };

  const isAssigned = ['ACCEPTED', 'ASSIGNED', 'TEMPORARY_WINNER', 'IN_TRANSIT', 'DELIVERED'].includes(localStatus);

  // Render PENDING state: show Accept / Decline buttons
  if (localStatus === 'PENDING') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
        <button
          onClick={handleAccept}
          disabled={isAccepting}
          style={{
            width: '100%', padding: '14px 18px', borderRadius: '14px', border: 'none',
            background: '#16a34a', color: 'white', fontWeight: 800,
            cursor: isAccepting ? 'not-allowed' : 'pointer',
            opacity: isAccepting ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          {isAccepting ? (
            <>
              <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Accepting...
            </>
          ) : (
            <><CheckCircle2 size={18} /> Accept Request</>
          )}
        </button>
        <button
          onClick={() => setShowDeclineModal(true)}
          style={{
            width: '100%', padding: '12px 18px', borderRadius: '14px',
            border: '1px solid #dc2626', background: 'transparent', color: '#dc2626',
            fontWeight: 800, cursor: 'pointer',
          }}
        >
          Decline Request
        </button>

        {showDeclineModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
            <div style={{ background: '#fff', borderRadius: '20px', width: 'min(400px, 100%)', padding: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.25rem', color: '#0f172a' }}>Decline Request</h3>
              <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '14px' }}>Please select a reason for declining this delivery request.</p>
              
              <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
                {declineReasons.map(r => (
                  <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#334155', fontWeight: 500 }}>
                    <input type="radio" name="decline_reason" value={r} checked={declineReason === r} onChange={(e) => setDeclineReason(e.target.value)} />
                    {r}
                  </label>
                ))}
                {declineReason === 'Other' && (
                  <input 
                    type="text" 
                    placeholder="Please specify..." 
                    value={otherReason} 
                    onChange={e => setOtherReason(e.target.value)} 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} 
                  />
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setShowDeclineModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#f1f5f9', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>Close</button>
                <button onClick={handleDeclineSubmit} disabled={isDeclining} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, cursor: isDeclining ? 'not-allowed' : 'pointer', opacity: isDeclining ? 0.7 : 1 }}>{isDeclining ? 'Declining...' : 'Confirm Decline'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Non-pending states
  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div style={{ padding: '16px 20px', borderRadius: '18px', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', justifyContent: 'center' }}>
        {localStatus === 'DELIVERED' && <StateMessage icon={<CheckCircle2 size={18} />} color="#16a34a" text="You completed this delivery" />}
        {['ACCEPTED', 'ASSIGNED', 'TEMPORARY_WINNER'].includes(localStatus) && <StateMessage icon={<CheckCircle2 size={18} />} color="#16a34a" text="You have been assigned!" />}
        {localStatus === 'IN_TRANSIT' && <StateMessage icon={<CheckCircle2 size={18} />} color="#4f46e5" text="You are delivering this order" />}
        {localStatus === 'DECLINED' && <StateMessage icon={<XCircle size={18} />} color="#dc2626" text="You declined this request" />}
        {localStatus === 'CANCELLED' && <StateMessage icon={<XCircle size={18} />} color="#dc2626" text="You cancelled this assignment" />}
        {localStatus === 'EXPIRED' && <StateMessage icon={<Clock size={18} />} color="#94a3b8" text="This invitation has expired" />}
        {!isAssigned && !['DECLINED', 'CANCELLED', 'EXPIRED', 'DELIVERED'].includes(localStatus) && <StateMessage icon={<AlertTriangle size={18} />} color="#64748b" text="Request is closed" />}
      </div>
      
      {['ACCEPTED', 'ASSIGNED', 'TEMPORARY_WINNER'].includes(localStatus) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            onClick={() => setShowStartModal(true)} 
            disabled={isStarting}
            style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 800, cursor: isStarting ? 'not-allowed' : 'pointer', opacity: isStarting ? 0.7 : 1 }}
          >
            {isStarting ? 'Starting...' : 'Start Delivery'}
          </button>
          <button 
            onClick={() => setShowCancelModal(true)} 
            style={{ width: '100%', padding: '12px 18px', borderRadius: '14px', border: '1px solid #dc2626', background: 'transparent', color: '#dc2626', fontWeight: 800, cursor: 'pointer' }}
          >
            Cancel Assignment
          </button>
        </div>
      )}

      {localStatus === 'IN_TRANSIT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            onClick={() => setShowCompleteModal(true)} 
            style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: 'none', background: '#16a34a', color: 'white', fontWeight: 800, cursor: 'pointer' }}
          >
            Complete Delivery
          </button>
        </div>
      )}

      {showStartModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', width: 'min(400px, 100%)', padding: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.25rem', color: '#0f172a' }}>Start Delivery</h3>
            <p style={{ margin: '0 0 20px', color: '#475569', fontSize: '14px', lineHeight: 1.5 }}>Please provide the details of the driver assigned to this delivery.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Driver Name</label>
                <input 
                  type="text" 
                  value={driverName} 
                  onChange={e => setDriverName(e.target.value)} 
                  placeholder="e.g. John Doe"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Driver Contact Number</label>
                <input 
                  type="text" 
                  value={driverContact} 
                  onChange={e => setDriverContact(e.target.value)} 
                  placeholder="e.g. 09123456789"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} 
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowStartModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#f1f5f9', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleStartSubmit} disabled={isStarting || !driverName.trim() || !driverContact.trim()} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, cursor: isStarting || !driverName.trim() || !driverContact.trim() ? 'not-allowed' : 'pointer', opacity: isStarting || !driverName.trim() || !driverContact.trim() ? 0.7 : 1 }}>{isStarting ? 'Starting...' : 'Start Delivery'}</button>
            </div>
          </div>
        </div>
      )}

      {showCompleteModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', width: 'min(400px, 100%)', padding: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.25rem', color: '#0f172a' }}>Complete Delivery?</h3>
            <p style={{ margin: '0 0 20px', color: '#475569', fontSize: '15px', lineHeight: 1.5 }}>Are you sure this delivery has been successfully completed? The business owner will be notified.</p>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowCompleteModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#f1f5f9', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleCompleteSubmit} disabled={isCompleting} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: isCompleting ? 'not-allowed' : 'pointer', opacity: isCompleting ? 0.7 : 1 }}>{isCompleting ? 'Completing...' : 'Confirm Completion'}</button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', width: 'min(400px, 100%)', padding: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.25rem', color: '#0f172a' }}>Cancel Assignment</h3>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '14px' }}>Please select a reason for cancelling this delivery assignment.</p>
            
            <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
              {cancelReasons.map(r => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#334155', fontWeight: 500 }}>
                  <input type="radio" name="cancel_reason" value={r} checked={cancelReason === r} onChange={(e) => setCancelReason(e.target.value)} />
                  {r}
                </label>
              ))}
              {cancelReason === 'Other' && (
                <input 
                  type="text" 
                  placeholder="Please specify..." 
                  value={otherReason} 
                  onChange={e => setOtherReason(e.target.value)} 
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} 
                />
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowCancelModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#f1f5f9', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>Close</button>
              <button onClick={handleCancelSubmit} disabled={isDeclining} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, cursor: isDeclining ? 'not-allowed' : 'pointer', opacity: isDeclining ? 0.7 : 1 }}>{isDeclining ? 'Cancelling...' : 'Confirm Cancel'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StateMessage({ icon, color, text }: { icon: React.ReactNode; color: string; text: string }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color, fontWeight: 700 }}>{icon} {text}</div>;
}
