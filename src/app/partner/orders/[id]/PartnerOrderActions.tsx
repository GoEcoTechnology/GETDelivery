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
  const [declineReason, setDeclineReason] = useState('Too far');
  const [otherReason, setOtherReason] = useState('');

  const declineReasons = ['Too far', 'Vehicle unavailable', 'Personal emergency', 'Already handling another delivery', 'Other'];

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
      <div style={{ padding: '16px 20px', borderRadius: '18px', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', justifyContent: 'center' }}>
        {status === 'TEMPORARY_WINNER' && <StateMessage icon={<Clock size={18} />} color="#4f46e5" text="Awaiting tenant approval" />}
        {status === 'ASSIGNED' && <StateMessage icon={<CheckCircle2 size={18} />} color="#16a34a" text="You have been assigned!" />}
        {status === 'DECLINED' && <StateMessage icon={<XCircle size={18} />} color="#dc2626" text="You declined this request" />}
        {!['TEMPORARY_WINNER', 'ASSIGNED', 'DECLINED'].includes(status) && <StateMessage icon={<AlertTriangle size={18} />} color="#64748b" text="Request is closed" />}
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
