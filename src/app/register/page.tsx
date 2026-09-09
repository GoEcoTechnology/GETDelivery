'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import s from './register.module.css';

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
      const payload =
        type === 'tenant'
          ? { type: 'tenant', businessName, email: tenantEmail, password: tenantPassword }
          : { type: 'partner', companyName, contactPerson, mobileNumber, email: partnerEmail, password: partnerPassword };

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      setSuccess(data.message || 'Your registration has been submitted successfully.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ── Success screen ── */
  if (success) {
    return (
      <main className={s.page}>
        <div className={s.card}>
          <div className={s.successCard}>
            <div className={s.successEmoji}>✅</div>
            <h2 className={s.successTitle}>Registration Submitted!</h2>
            <p className={s.successMsg}>{success} Your account is under review. You'll be notified once it's activated and ready to use.</p>
            <Link href="/login" className={s.backToLogin}>Back to Sign In</Link>
          </div>
        </div>
      </main>
    );
  }

  /* ── Main page ── */
  return (
    <main className={s.page}>
      <div className={s.card}>

        {/* Header */}
        <div className={s.header}>
          <div className={s.logo}>
            <div className={s.logoIcon}>🚛</div>
            <span className={s.logoText}>GETDelivery</span>
          </div>
          <h1 className={s.title}>Create Account</h1>
          <p className={s.subtitle}>Join GETDelivery — choose your account type below</p>
        </div>

        {/* Type selector */}
        {!type && (
          <div className={s.typeGrid}>
            <button className={s.typeCard} onClick={() => setType('tenant')}>
              <span className={s.typeEmoji}>🏢</span>
              <span className={s.typeLabel}>Business / Tenant</span>
              <span className={s.typeDesc}>Manage deliveries &amp; inventory</span>
            </button>
            <button className={s.typeCard} onClick={() => setType('partner')}>
              <span className={s.typeEmoji}>🚚</span>
              <span className={s.typeLabel}>Delivery Partner</span>
              <span className={s.typeDesc}>Accept &amp; fulfill deliveries</span>
            </button>
          </div>
        )}

        {/* ── Tenant Form ── */}
        {type === 'tenant' && (
          <form className={s.form} onSubmit={handleSubmit}>
            <div className={s.backRow}>
              <button type="button" className={s.backBtn} onClick={() => { setType(null); setError(''); }}>
                ← Back
              </button>
              <span className={s.formTitle}>🏢 Business Registration</span>
            </div>

            {error && <div className={s.error}>{error}</div>}

            <div className={s.fieldFull}>
              <div className={s.fieldGroup}>
                <label className={s.label}>Business Name</label>
                <div className={s.inputWrap}>
                  <span className={s.inputIcon}>🏢</span>
                  <input
                    id="tenant-business-name"
                    type="text"
                    className={s.input}
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    required
                    placeholder="Your company or business name"
                    autoComplete="organization"
                  />
                </div>
              </div>
            </div>

            <div className={s.fieldFull}>
              <div className={s.fieldGroup}>
                <label className={s.label}>Email Address</label>
                <div className={s.inputWrap}>
                  <span className={s.inputIcon}>✉️</span>
                  <input
                    id="tenant-email"
                    type="email"
                    className={s.input}
                    value={tenantEmail}
                    onChange={e => setTenantEmail(e.target.value)}
                    required
                    placeholder="owner@business.com"
                    autoComplete="email"
                  />
                </div>
              </div>
            </div>

            <div className={s.fieldFull}>
              <div className={s.fieldGroup}>
                <label className={s.label}>Password</label>
                <div className={s.inputWrap}>
                  <span className={s.inputIcon}>🔒</span>
                  <input
                    id="tenant-password"
                    type="password"
                    className={s.input}
                    value={tenantPassword}
                    onChange={e => setTenantPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            <div className={s.notice}>
              <span className={s.noticeIcon}>⏳</span>
              <span>Your account will be under review. You'll be notified once it's activated and ready to use.</span>
            </div>

            <button id="tenant-submit" type="submit" className={s.submitBtn} disabled={loading}>
              {loading ? 'Submitting…' : 'Submit Registration'}
            </button>

            <div className={s.footerLink}>
              Already have an account? <Link href="/login">Sign In</Link>
            </div>
          </form>
        )}

        {/* ── Partner Form ── */}
        {type === 'partner' && (
          <form className={s.form} onSubmit={handleSubmit}>
            <div className={s.backRow}>
              <button type="button" className={s.backBtn} onClick={() => { setType(null); setError(''); }}>
                ← Back
              </button>
              <span className={s.formTitle}>🚚 Delivery Partner Registration</span>
            </div>

            {error && <div className={s.error}>{error}</div>}

            <div className={s.fieldsGrid}>
              <div className={s.fieldGroup}>
                <label className={s.label}>Company Name</label>
                <div className={s.inputWrap}>
                  <span className={s.inputIcon}>🏭</span>
                  <input
                    id="partner-company-name"
                    type="text"
                    className={s.input}
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    required
                    placeholder="Company name"
                    autoComplete="organization"
                  />
                </div>
              </div>

              <div className={s.fieldGroup}>
                <label className={s.label}>Contact Person</label>
                <div className={s.inputWrap}>
                  <span className={s.inputIcon}>👤</span>
                  <input
                    id="partner-contact-person"
                    type="text"
                    className={s.input}
                    value={contactPerson}
                    onChange={e => setContactPerson(e.target.value)}
                    required
                    placeholder="Full name"
                    autoComplete="name"
                  />
                </div>
              </div>

              <div className={s.fieldGroup}>
                <label className={s.label}>Mobile Number</label>
                <div className={s.inputWrap}>
                  <span className={s.inputIcon}>📱</span>
                  <input
                    id="partner-mobile"
                    type="tel"
                    className={s.input}
                    value={mobileNumber}
                    onChange={e => setMobileNumber(e.target.value)}
                    required
                    placeholder="09XXXXXXXXX"
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div className={s.fieldGroup}>
                <label className={s.label}>Email Address</label>
                <div className={s.inputWrap}>
                  <span className={s.inputIcon}>✉️</span>
                  <input
                    id="partner-email"
                    type="email"
                    className={s.input}
                    value={partnerEmail}
                    onChange={e => setPartnerEmail(e.target.value)}
                    required
                    placeholder="partner@company.com"
                    autoComplete="email"
                  />
                </div>
              </div>
            </div>

            <div className={s.fieldFull}>
              <div className={s.fieldGroup}>
                <label className={s.label}>Password</label>
                <div className={s.inputWrap}>
                  <span className={s.inputIcon}>🔒</span>
                  <input
                    id="partner-password"
                    type="password"
                    className={s.input}
                    value={partnerPassword}
                    onChange={e => setPartnerPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            <div className={s.notice}>
              <span className={s.noticeIcon}>⏳</span>
              <span>Your account will be under review. You'll be notified once it's activated and ready to use.</span>
            </div>

            <button id="partner-submit" type="submit" className={s.submitBtn} disabled={loading}>
              {loading ? 'Submitting…' : 'Submit Registration'}
            </button>

            <div className={s.footerLink}>
              Already have an account? <Link href="/login">Sign In</Link>
            </div>
          </form>
        )}

        {/* Footer (type selector screen only) */}
        {!type && (
          <div className={s.footerLink} style={{ marginTop: '1.5rem' }}>
            Already have an account? <Link href="/login">Sign In</Link>
          </div>
        )}
      </div>
    </main>
  );
}
