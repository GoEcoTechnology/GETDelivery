'use client';
import { useState } from 'react';
import Link from 'next/link';
import s from './register.module.css';
import MapPicker from '@/components/MapPicker';

type RegType = 'tenant' | 'partner' | 'customer' | null;

export default function RegisterPage() {
  const [type, setType] = useState<RegType>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Customer fields
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPassword, setCustomerPassword] = useState('');

  // Tenant fields
  const [businessName, setBusinessName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPassword, setTenantPassword] = useState('');
  const [tenantLocation, setTenantLocation] = useState<{lat: number; lng: number; address: string; landmark?: string} | null>(null);

  // Partner fields
  const [companyName, setCompanyName] = useState('');
  const [partnerContact, setPartnerContact] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [partnerPassword, setPartnerPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let payload;
      if (type === 'tenant') {
        if (!tenantLocation) {
          throw new Error('Please select your business location on the map.');
        }
        payload = { 
          type: 'tenant', 
          businessName, 
          contactPerson, 
          email: tenantEmail, 
          password: tenantPassword,
          address: tenantLocation.address + (tenantLocation.landmark ? ` (${tenantLocation.landmark})` : ''),
          lat: tenantLocation.lat,
          lng: tenantLocation.lng
        };
      } else if (type === 'partner') {
        payload = { type: 'partner', companyName, contactPerson: partnerContact, mobileNumber, email: partnerEmail, password: partnerPassword };
      } else {
        payload = { type: 'customer', name: customerName, email: customerEmail, password: customerPassword };
      }

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setSuccess(data.message || 'Registration submitted successfully.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => { setType(null); setError(''); };

  /* ── Success ── */
  if (success) {
    return (
      <main className={s.page}>
        <div className={s.card}>
          <div className={s.successCard}>
            <div className={s.successIcon}>✓</div>
            <h2 className={s.successTitle}>Registration Submitted</h2>
            <p className={s.successMsg}>
              {type === 'customer' ? 'Your account has been successfully created and is ready to use.' : 'Your account is under review. You\'ll be notified once it\'s activated and ready to use.'}
            </p>
            <Link href="/login" className={s.backToLogin}>Back to Sign In</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={s.page}>
      <div className={s.card}>

        {/* Header */}
        <div className={s.header}>
          <p className={s.brandName}>GETDelivery</p>
          <h1 className={s.title}>Create an Account</h1>
          <p className={s.subtitle}>Select your account type to get started</p>
        </div>

        {/* Type selector */}
        {!type && (
          <div className={s.typeGrid}>
            <button id="select-tenant" className={s.typeCard} onClick={() => setType('tenant')}>
              <span className={s.typeIcon}>🏢</span>
              <span className={s.typeLabel}>Business / Tenant</span>
              <span className={s.typeDesc}>Manage deliveries &amp; inventory</span>
            </button>
            <button id="select-partner" className={s.typeCard} onClick={() => setType('partner')}>
              <span className={s.typeIcon}>🚚</span>
              <span className={s.typeLabel}>Delivery Partner</span>
              <span className={s.typeDesc}>Accept &amp; fulfill deliveries</span>
            </button>
            <button id="select-customer" className={s.typeCard} onClick={() => setType('customer')}>
              <span className={s.typeIcon}>🛒</span>
              <span className={s.typeLabel}>Customer</span>
              <span className={s.typeDesc}>Shop and order from local businesses</span>
            </button>
          </div>
        )}

        {/* ── Customer Form ── */}
        {type === 'customer' && (
          <form id="customer-form" className={s.form} onSubmit={handleSubmit}>
            <div className={s.backRow}>
              <button type="button" className={s.backBtn} onClick={resetForm}>← Back</button>
              <span className={s.formTitle}>Customer Registration</span>
            </div>

            {error && <div className={s.error}>{error}</div>}

            <div className={s.fieldsGrid}>
              <div className={s.fieldGroup}>
                <label className={s.label} htmlFor="c-name">Full Name</label>
                <input
                  id="c-name"
                  type="text"
                  className={s.input}
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  required
                  placeholder="John Doe"
                  autoComplete="name"
                />
              </div>

              <div className={s.fieldGroup}>
                <label className={s.label} htmlFor="c-email">Email Address</label>
                <input
                  id="c-email"
                  type="email"
                  className={s.input}
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  required
                  placeholder="john@example.com"
                  autoComplete="email"
                />
              </div>

              <div className={s.fieldGroup}>
                <label className={s.label} htmlFor="c-password">Password</label>
                <input
                  id="c-password"
                  type="password"
                  className={s.input}
                  value={customerPassword}
                  onChange={e => setCustomerPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button id="customer-submit" type="submit" className={s.submitBtn} disabled={loading} style={{ marginTop: '24px' }}>
              {loading ? 'Submitting...' : 'Submit Registration'}
            </button>

            <div className={s.footerLink}>
              Already have an account? <Link href="/login">Sign In</Link>
            </div>
          </form>
        )}

        {/* ── Tenant Form ── */}
        {type === 'tenant' && (
          <form id="tenant-form" className={s.form} onSubmit={handleSubmit}>
            <div className={s.backRow}>
              <button type="button" className={s.backBtn} onClick={resetForm}>← Back</button>
              <span className={s.formTitle}>Business Registration</span>
            </div>

            {error && <div className={s.error}>{error}</div>}

            <div className={s.fieldsGrid}>
              <div className={s.fieldGroup}>
                <label className={s.label} htmlFor="t-business">Business Name</label>
                <input
                  id="t-business"
                  type="text"
                  className={s.input}
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  required
                  placeholder="e.g. Acme Corp"
                  autoComplete="organization"
                />
              </div>

              <div className={s.fieldGroup}>
                <label className={s.label} htmlFor="t-contact">Contact Person</label>
                <input
                  id="t-contact"
                  type="text"
                  className={s.input}
                  value={contactPerson}
                  onChange={e => setContactPerson(e.target.value)}
                  required
                  placeholder="Full name"
                  autoComplete="name"
                />
              </div>

              <div className={s.fieldGroup}>
                <label className={s.label} htmlFor="t-email">Email Address</label>
                <input
                  id="t-email"
                  type="email"
                  className={s.input}
                  value={tenantEmail}
                  onChange={e => setTenantEmail(e.target.value)}
                  required
                  placeholder="owner@business.com"
                  autoComplete="email"
                />
              </div>

              <div className={s.fieldGroup}>
                <label className={s.label} htmlFor="t-password">Password</label>
                <input
                  id="t-password"
                  type="password"
                  className={s.input}
                  value={tenantPassword}
                  onChange={e => setTenantPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                />
              </div>
              <div className={s.fieldGroup} style={{ gridColumn: '1 / -1' }}>
                <label className={s.label}>Business Location</label>
                <div style={{ marginBottom: '8px', fontSize: '13px', color: '#64748b' }}>
                  Search for your business address and click on the map to drop a pin.
                </div>
                <MapPicker 
                  onLocationSelect={setTenantLocation} 
                  height="250px"
                />
                {!tenantLocation && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>* Location is required</div>}
              </div>
            </div>

            <div className={s.notice}>
              Your account will be under review. You'll be notified once it's activated and ready to use.
            </div>

            <button id="tenant-submit" type="submit" className={s.submitBtn} disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Registration'}
            </button>

            <div className={s.footerLink}>
              Already have an account? <Link href="/login">Sign In</Link>
            </div>
          </form>
        )}

        {/* ── Partner Form ── */}
        {type === 'partner' && (
          <form id="partner-form" className={s.form} onSubmit={handleSubmit}>
            <div className={s.backRow}>
              <button type="button" className={s.backBtn} onClick={resetForm}>← Back</button>
              <span className={s.formTitle}>Delivery Partner Registration</span>
            </div>

            {error && <div className={s.error}>{error}</div>}

            <div className={s.fieldsGrid}>
              <div className={s.fieldGroup}>
                <label className={s.label} htmlFor="p-company">Company Name</label>
                <input
                  id="p-company"
                  type="text"
                  className={s.input}
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  required
                  placeholder="Company name"
                  autoComplete="organization"
                />
              </div>

              <div className={s.fieldGroup}>
                <label className={s.label} htmlFor="p-contact">Contact Person</label>
                <input
                  id="p-contact"
                  type="text"
                  className={s.input}
                  value={partnerContact}
                  onChange={e => setPartnerContact(e.target.value)}
                  required
                  placeholder="Full name"
                  autoComplete="name"
                />
              </div>

              <div className={s.fieldGroup}>
                <label className={s.label} htmlFor="p-mobile">Mobile Number</label>
                <input
                  id="p-mobile"
                  type="tel"
                  className={s.input}
                  value={mobileNumber}
                  onChange={e => setMobileNumber(e.target.value)}
                  required
                  placeholder="09XXXXXXXXX"
                  autoComplete="tel"
                />
              </div>

              <div className={s.fieldGroup}>
                <label className={s.label} htmlFor="p-email">Email Address</label>
                <input
                  id="p-email"
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

            <div className={s.fieldFull}>
              <div className={s.fieldGroup}>
                <label className={s.label} htmlFor="p-password">Password</label>
                <input
                  id="p-password"
                  type="password"
                  className={s.input}
                  value={partnerPassword}
                  onChange={e => setPartnerPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className={s.notice}>
              Your account will be under review. You'll be notified once it's activated and ready to use.
            </div>

            <button id="partner-submit" type="submit" className={s.submitBtn} disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Registration'}
            </button>

            <div className={s.footerLink}>
              Already have an account? <Link href="/login">Sign In</Link>
            </div>
          </form>
        )}

        {/* Footer on type-selector screen */}
        {!type && (
          <div className={s.footerLink} style={{ marginTop: '1.5rem' }}>
            Already have an account? <Link href="/login">Sign In</Link>
          </div>
        )}
      </div>
    </main>
  );
}
