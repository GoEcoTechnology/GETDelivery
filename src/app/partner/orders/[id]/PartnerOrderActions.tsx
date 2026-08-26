'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import styles from '../../partner.module.css';

export default function PartnerOrderActions({ orderId, status }: { orderId: number, status: string }) {
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

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

  const handleDecline = async () => {
    const reason = prompt("Please tell us why you are declining this request (optional):");
    if (reason === null) return; // User cancelled prompt
    
    setIsDeclining(true);
    try {
      const res = await fetch(`/api/partner/orders/${orderId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ declineReason: reason }),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to decline');
      
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
      <div className={styles.actionsContainer} style={{ justifyContent: 'center' }}>
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
    <div className={styles.actionsContainer}>
      <button 
        className={styles.btnSecondary} 
        onClick={handleDecline} 
        disabled={isDeclining}
      >
        {isDeclining ? 'Declining...' : 'Decline'}
      </button>

      <button 
        className={styles.btnPrimary} 
        onClick={handleAccept}
        disabled={isAccepting}
      >
        {isAccepting ? 'Accepting...' : 'Accept Request'}
      </button>
    </div>
  );
}
