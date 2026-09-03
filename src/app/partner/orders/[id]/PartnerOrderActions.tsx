'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Clock, AlertTriangle, Trash2 } from 'lucide-react';

type ApiError = {
  error?: string;
};

export default function PartnerOrderActions({ orderId, status }: { orderId: number; status: string }) {
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('Too far');
  const [cancelReason, setCancelReason] = useState('Vehicle breakdown');
  const [otherReason, setOtherReason] = useState('');

  const declineReasons = ['Too far', 'Vehicle unavailable', 'Personal emergency', 'Already handling another delivery', 'Other'];
  const cancelReasons = ['Vehicle breakdown', 'Personal emergency', 'Package too large', 'Accident', 'Other'];

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const res = await fetch(`/api/partner/orders/${orderId}/accept`, { method: 'POST' });
      const data = (await res.json()) as ApiError;
      if (!res.ok) throw new Error(data.error || 'Failed to accept');
      alert('Accepted! Waiting for tenant approval.');
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
      alert('Declined request.');
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
      alert('Delivery assignment cancelled.');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert(`Error: ${message}`);
    } finally {
      setIsDeclining(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this order and all related data? This cannot be undone.')) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/partner/orders/${orderId}/delete`, { method: 'POST' });
      const data = (await res.json()) as ApiError;
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      alert('Order deleted.');
      router.push('/partner/orders');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert(`Error: ${message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  if (status !== 'PENDING') {
    return (
      <div style={{ display: 'grid', gap: '16px' }}>
        <div style={{ padding: '16px 20px', borderRadius: '18px', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', justifyContent: 'center' }}>
          {status === 'TEMPORARY_WINNER' && <StateMessage icon={<Clock size={18} />} color="#4f46e5" text="Awaiting tenant approval" />}
          {status === 'ASSIGNED' && <StateMessage icon={<CheckCircle2 size={18} />} color="#16a34a" text="You have been assigned!" />}
          {status === 'DECLINED' && <StateMessage icon={<XCircle size={18} />} color="#dc2626" text="You declined this request" />}
          {status === 'CANCELLED' && <StateMessage icon={<XCircle size={18} />} color="#dc2626" text="You cancelled this assignment" />}
          {!['TEMPORARY_WINNER', 'ASSIGNED', 'DECLINED', 'CANCELLED'].includes(status) && <StateMessage icon={<AlertTriangle size={18} />} color="#64748b" text="Request is closed" />}
        </div>
        
        {(status === 'TEMPORARY_WINNER' || status === 'ASSIGNED') && (
          <div>
            <button 
              onClick={() => setShowCancelModal(true)} 
              style={{ width: '100%', padding: '12px 18px', borderRadius: '14px', border: '1px solid #dc2626', background: 'transparent', color: '#dc2626', fontWeight: 800, cursor: 'pointer' }}
            >
              Cancel Assignment
            </button>
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

  return (
    <div style={{ marginTop: '16px' }}>
      <button 
        onClick={handleAccept} 
        disabled={isAccepting} 
        style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: 'none', background: '#16a34a', color: 'white', fontWeight: 800, cursor: 'pointer' }}
      >
        {isAccepting ? 'Accepting...' : 'Accept Request'}
      </button>
    </div>
  );
}

function StateMessage({ icon, color, text }: { icon: React.ReactNode; color: string; text: string }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color, fontWeight: 700 }}>{icon} {text}</div>;
}
