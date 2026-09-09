'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../login/page.module.css';
import regStyles from './register.module.css';

type RegType = 'tenant' | 'partner' | null;

export default function RegisterPage() {
  const router = useRouter();
  const [type, setType] = useState<RegType>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Tenant fields
  const [businessName, setBusinessName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPassword, setTenantPassword] = useState('');

  // Partner fields
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [partnerPassword, setPartnerPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = type === 'tenant'
        ? { type: 'tenant', businessName, email: tenantEmail, password: tenantPassword }
        : { type: 'partner', companyName, contactPerson, mobileNumber, email: partnerEmail, password: partnerPassword };

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      setSuccess(data.message || 'Registration successful! Awaiting Super Admin approval.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className={styles.container}>
        <div className={`${styles.card} glass`} style={{ maxWidth: 480, textAlign: 'center', gap: '24px' }}>
          <div style={{ fontSize: 56, lineHeight: 1 }}>✅</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Registration Submitted!</h2>
          <p style={{ color: '#64748b', margin: 0, lineHeight: 1.6 }}>{success}</p>
          <Link href="/login" style={{ display: 'inline-block', padding: '12px 24px', background: 'linear-gradient(135deg, #4f46e5, #2563eb)', color: 'white', borderRadius: 10, fontWeight: 600, textDecoration: 'none', fontSize: 14 }}>
            Back to Login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <div className={`${styles.card} glass`} style={{ maxWidth: type ? 520 : 460, transition: 'max-width 0.3s ease' }}>
        <div>
          <h1 className={styles.title} style={{ fontSize: '1.75rem' }}>Create Account</h1>
          <p className={styles.label} style={{ textAlign: 'center' }}>
            Join GETDelivery — choose your account type
          </p>
        </div>

        {/* Type Selector */}
        {!type && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
            <button
              onClick={() => setType('tenant')}
              style={{
                padding: '28px 20px', border: '2px solid #e2e8f0', borderRadius: 16, background: 'white',
                cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 12, fontFamily: 'inherit'
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#4f46e5')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
            >
              <span style={{ fontSize: 36 }}>🏢</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Business / Tenant</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Manage deliveries & inventory</div>
              </div>
            </button>
            <button
              onClick={() => setType('partner')}
              style={{
                padding: '28px 20px', border: '2px solid #e2e8f0', borderRadius: 16, background: 'white',
                cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 12, fontFamily: 'inherit'
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#4f46e5')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
            >
              <span style={{ fontSize: 36 }}>🚚</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Delivery Partner</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Accept & fulfill deliveries</div>
              </div>
            </button>
          </div>
        )}

        {/* Tenant Form */}
        {type === 'tenant' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <button type="button" onClick={() => { setType(null); setError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                ← Back
              </button>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>🏢 Business Registration</span>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.formGroup}>
              <label className={styles.label}>Business Name</label>
              <input type="text" className={styles.input} value={businessName} onChange={e => setBusinessName(e.target.value)} required placeholder="Your company or business name" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Email Address</label>
              <input type="email" className={styles.input} value={tenantEmail} onChange={e => setTenantEmail(e.target.value)} required placeholder="owner@business.com" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Password</label>
              <input type="password" className={styles.input} value={tenantPassword} onChange={e => setTenantPassword(e.target.value)} required minLength={6} placeholder="Min. 6 characters" />
            </div>

            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#92400e' }}>
              ⏳ Your account will be under review. You'll be notified once it's activated and ready to use.
            </div>

            <button type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Registration'}
            </button>
          </form>
        )}

        {/* Partner Form */}
        {type === 'partner' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <button type="button" onClick={() => { setType(null); setError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                ← Back
              </button>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>🚚 Delivery Partner Registration</span>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Company Name</label>
                <input type="text" className={styles.input} value={companyName} onChange={e => setCompanyName(e.target.value)} required placeholder="Logistics Co." />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Contact Person</label>
                <input type="text" className={styles.input} value={contactPerson} onChange={e => setContactPerson(e.target.value)} required placeholder="Full name" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Mobile Number</label>
                <input type="text" className={styles.input} value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} required placeholder="09XXXXXXXXX" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Email Address</label>
                <input type="email" className={styles.input} value={partnerEmail} onChange={e => setPartnerEmail(e.target.value)} required placeholder="partner@logistics.com" />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Password</label>
              <input type="password" className={styles.input} value={partnerPassword} onChange={e => setPartnerPassword(e.target.value)} required minLength={6} placeholder="Min. 6 characters" />
            </div>

            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#92400e' }}>
              ⏳ Your account will be under review. You'll be notified once it's activated and ready to use.
            </div>

            <button type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Registration'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', fontSize: 14, color: '#64748b' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}>Sign In</Link>
        </div>
      </div>
    </main>
  );
}
