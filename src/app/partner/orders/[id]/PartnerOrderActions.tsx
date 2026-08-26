'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import styles from '../../partner.module.css';

export default function PartnerOrderActions({ orderId, status }: { orderId: number, status: string }) {
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('Too far');
  const [otherReason, setOtherReason] = useState('');

  const declineReasons = [
    'Too far',
    'Vehicle unavailable',
    'Personal emergency',
    'Already handling another delivery',
    'Other'
  ];

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const res = await fetch(`/api/partner/orders/${orderId}/accept`, {
        method: 'POST',
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to accept');
      
      alert("Accepted! You have accepted this request. Waiting for tenant approval.");
      router.refresh();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDeclineSubmit = async () => {
    const finalReason = declineReason === 'Other' ? otherReason : declineReason;
    if (!finalReason) {
      alert('Please provide a reason');
      return;
    }

    setIsDeclining(true);
    try {
      const res = await fetch(`/api/partner/orders/${orderId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ declineReason: finalReason }),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to decline');
      
      setShowDeclineModal(false);
      alert("Declined! You have declined this request.");
      router.refresh();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsDeclining(false);
    }
  };

  if (status !== 'PENDING') {
    return (
      <div className={styles.stickyBottomBar} style={{ justifyContent: 'center' }}>
        {status === 'TEMPORARY_WINNER' ? (
          <div style={{ display: 'flex', alignItems: 'center', color: '#4f46e5', gap: '8px', fontWeight: 500 }}>
            <Clock size={20} /> Awaiting tenant approval
          </div>
        ) : status === 'ASSIGNED' ? (
          <div style={{ display: 'flex', alignItems: 'center', color: '#16a34a', gap: '8px', fontWeight: 500 }}>
            <CheckCircle2 size={20} /> You have been assigned!
          </div>
        ) : status === 'DECLINED' ? (
          <div style={{ display: 'flex', alignItems: 'center', color: '#dc2626', gap: '8px', fontWeight: 500 }}>
            <XCircle size={20} /> You declined this request
          </div>
        ) : (
          <div style={{ color: '#64748b', fontWeight: 500 }}>Request is closed</div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={styles.stickyBottomBar}>
        <button 
          className={styles.declineBtn} 
          onClick={() => setShowDeclineModal(true)} 
          disabled={isDeclining || isAccepting}
        >
          {isDeclining ? 'Declining...' : 'Decline'}
        </button>

        <button 
          className={styles.acceptBtn} 
          onClick={handleAccept}
          disabled={isAccepting || isDeclining}
        >
          {isAccepting ? 'Accepting...' : 'Accept Request'}
        </button>
      </div>

      {showDeclineModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 style={{ marginTop: 0 }}>Decline Request</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>Please tell us why you are declining this request.</p>
            
            <select 
              value={declineReason} 
              onChange={(e) => setDeclineReason(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '16px', fontSize: '16px' }}
            >
              {declineReasons.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {declineReason === 'Other' && (
              <textarea
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Type your reason here..."
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '16px', minHeight: '80px', fontSize: '14px' }}
                required
              />
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowDeclineModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ccc', background: 'white', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleDeclineSubmit} disabled={isDeclining} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: '#dc2626', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                {isDeclining ? 'Declining...' : 'Submit Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
