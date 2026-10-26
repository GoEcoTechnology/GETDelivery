'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from '@/app/admin/admin.module.css';
import {
  User,
  Lock,
  MapPin,
  Save,
  CheckCircle2,
  Navigation,
  Trash2,
  Star,
  Plus,
  AlertCircle,
  Loader2,
  Edit2,
  RotateCcw
} from 'lucide-react';
import MapPicker from '@/components/MapPicker';

type TabKey = 'profile' | 'addresses';

export default function CustomerProfilePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileData, setProfileData] = useState({ name: '', email: '', contactNumber: '' });
  const [passwordData, setPasswordData] = useState({ password: '', confirmPassword: '' });

  // Location states
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [savedLocations, setSavedLocations] = useState<any[]>([]);
  const [defaultLocation, setDefaultLocation] = useState<any | null>(null);

  // Form states for setting / editing a location
  const [editLocationId, setEditLocationId] = useState<string | null>(null);
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationLandmark, setLocationLandmark] = useState('');
  const [isDefaultLocation, setIsDefaultLocation] = useState(true);
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/profile', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (res.ok) {
        const json = await res.json();
        setProfileData({
          name: json.user.name,
          email: json.user.email || '',
          contactNumber: json.user.contactNumber || ''
        });
      }
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (!user || !user.id) return;

      const res = await fetch(`/api/customer/locations?customerId=${user.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });

      if (res.ok) {
        const json = await res.json();
        const locs = json.data || [];
        setSavedLocations(locs);
        setDefaultLocation(json.defaultLocation || null);

        if (json.defaultLocation) {
          localStorage.setItem(`customer_default_location_${user.id}`, JSON.stringify(json.defaultLocation));
          // Pre-populate coordinates into form if not currently editing another
          setLocationAddress(json.defaultLocation.address || '');
          setLocationLat(Number(json.defaultLocation.lat));
          setLocationLng(Number(json.defaultLocation.lng));
          setLocationLandmark(json.defaultLocation.landmark || '');
        } else {
          localStorage.removeItem(`customer_default_location_${user.id}`);
          localStorage.removeItem('customer_default_location');
          setLocationAddress('');
          setLocationLat(null);
          setLocationLng(null);
          setLocationLandmark('');
        }
      }
    } catch (err) {
      console.error('Failed to fetch customer locations:', err);
    } finally {
      setLocationsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchLocations();
  }, [fetchProfile, fetchLocations]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    const passwordEntered = passwordData.password.trim().length > 0;
    const confirmEntered = passwordData.confirmPassword.trim().length > 0;

    if (passwordEntered || confirmEntered) {
      if (!passwordEntered || !confirmEntered) {
        alert('Enter the new password in both fields if you want to change it.');
        setProfileSaving(false);
        return;
      }
      if (passwordData.password !== passwordData.confirmPassword) {
        alert('Passwords do not match');
        setProfileSaving(false);
        return;
      }
    }

    try {
      const payload: any = {
        name: profileData.name,
        contactNumber: profileData.contactNumber
      };

      if (passwordEntered) payload.password = passwordData.password;

      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('Profile saved successfully!');
        setPasswordData({ password: '', confirmPassword: '' });

        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          user.name = payload.name;
          localStorage.setItem('user', JSON.stringify(user));
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save profile');
      }
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!locationLat || !locationLng) {
      alert('Please click on the map or search to pin your location coordinates.');
      return;
    }

    setSavingLocation(true);
    setLocationSuccessMsg(null);

    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (!user || !user.id) {
        alert('User session not found. Please log in again.');
        return;
      }

      const derivedName = locationLandmark.trim()
        ? locationLandmark.trim()
        : (locationAddress ? locationAddress.split(',')[0].trim() : 'Delivery Location');

      const payload = {
        customerId: user.id,
        location: {
          id: editLocationId || Date.now().toString(),
          locationName: derivedName,
          address: locationAddress || 'Pinned Location',
          lat: Number(locationLat),
          lng: Number(locationLng),
          landmark: locationLandmark.trim(),
          isDefault: isDefaultLocation
        }
      };

      const res = await fetch('/api/customer/locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const json = await res.json();
        setSavedLocations(json.data || []);
        if (json.defaultLocation) {
          setDefaultLocation(json.defaultLocation);
          localStorage.setItem(`customer_default_location_${user.id}`, JSON.stringify(json.defaultLocation));
        }
        setLocationSuccessMsg(
          editLocationId
            ? 'Location updated successfully!'
            : isDefaultLocation
            ? 'Default delivery location set! Future orders will automatically use this location.'
            : 'Delivery location saved successfully!'
        );
        setEditLocationId(null);
      } else {
        const err = await res.json();
        alert('Failed to save location: ' + (err.error || 'Server error'));
      }
    } catch (err) {
      console.error(err);
      alert('Network error while saving location.');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleSetDefaultLocation = async (locId: string) => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (!user || !user.id) return;

      const res = await fetch('/api/customer/locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          customerId: user.id,
          action: 'SET_DEFAULT',
          locationId: locId
        })
      });

      if (res.ok) {
        const json = await res.json();
        setSavedLocations(json.data || []);
        setDefaultLocation(json.defaultLocation);
        localStorage.setItem(`customer_default_location_${user.id}`, JSON.stringify(json.defaultLocation));
        setLocationSuccessMsg('Default delivery location updated!');
      } else {
        const err = await res.json();
        alert('Failed to set default location: ' + (err.error || 'Server error'));
      }
    } catch (err) {
      console.error(err);
      alert('Network error while setting default location.');
    }
  };

  const handleDeleteLocation = async (locId: string) => {
    if (!confirm('Are you sure you want to remove this saved location?')) return;

    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (!user || !user.id) return;

      const res = await fetch(`/api/customer/locations?customerId=${user.id}&locationId=${locId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        }
      });

      if (res.ok) {
        const json = await res.json();
        setSavedLocations(json.data || []);
        setDefaultLocation(json.defaultLocation || null);
        if (json.defaultLocation) {
          localStorage.setItem(`customer_default_location_${user.id}`, JSON.stringify(json.defaultLocation));
        } else {
          localStorage.removeItem(`customer_default_location_${user.id}`);
          localStorage.removeItem('customer_default_location');
        }
        if (editLocationId === locId) {
          setEditLocationId(null);
        }
      } else {
        const err = await res.json();
        alert('Failed to delete location: ' + (err.error || 'Server error'));
      }
    } catch (err) {
      console.error(err);
      alert('Network error while deleting location.');
    }
  };

  const handleEditLocation = (loc: any) => {
    setEditLocationId(loc.id || (loc.lat && loc.lng ? `${loc.lat},${loc.lng}` : 'loc-' + Date.now()));
    setLocationAddress(loc.address || '');
    setLocationLat(Number(loc.lat));
    setLocationLng(Number(loc.lng));
    setLocationLandmark(loc.landmark || '');
    setIsDefaultLocation(Boolean(loc.isDefault));
    setLocationSuccessMsg(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetLocationForm = () => {
    setEditLocationId(null);
    setLocationAddress('');
    setLocationLat(null);
    setLocationLng(null);
    setLocationLandmark('');
    setIsDefaultLocation(true);
    setLocationSuccessMsg(null);
  };

  if (profileLoading) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading Profile...</div>;

  const tabs = [
    { key: 'profile' as const, label: 'My Profile', icon: User },
    { key: 'addresses' as const, label: 'Delivery Location & Addresses', icon: MapPin }
  ];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingTop: '24px', paddingBottom: '120px' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid #e2e8f0', marginBottom: '32px' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              color: activeTab === tab.key ? '#4f46e5' : '#64748b',
              borderBottom: activeTab === tab.key ? '2px solid #4f46e5' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Profile & Password */}
      {activeTab === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Quick Location Preview Card */}
          <div
            style={{
              background: '#fff',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4f46e5', fontWeight: 700, fontSize: '17px' }}>
                <MapPin size={20} />
                <span>Default Delivery Location</span>
              </div>
              {defaultLocation && defaultLocation.lat && defaultLocation.lng ? (
                <span
                  style={{
                    background: '#dcfce7',
                    color: '#15803d',
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '999px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <CheckCircle2 size={13} /> Location Set
                </span>
              ) : (
                <span
                  style={{
                    background: '#fef3c7',
                    color: '#92400e',
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '999px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <AlertCircle size={13} /> Not Set Yet
                </span>
              )}
            </div>

            {defaultLocation && defaultLocation.lat && defaultLocation.lng ? (
              <div
                style={{
                  background: '#f8fafc',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px'
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      background: '#e0e7ff',
                      color: '#4338ca',
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <MapPin size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', lineHeight: 1.4 }}>
                      {defaultLocation.address || 'Pinned Location'}
                    </div>
                    {defaultLocation.landmark && (
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Navigation size={12} color="#4f46e5" />
                        <span>Landmark: <strong>{defaultLocation.landmark}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('addresses')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    background: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#334155',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s'
                  }}
                >
                  <Edit2 size={13} /> Change Location
                </button>
              </div>
            ) : (
              <div
                style={{
                  background: '#eff6ff',
                  borderRadius: '14px',
                  border: '1px solid #bfdbfe',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px'
                }}
              >
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <Navigation size={18} color="#2563eb" />
                  <span style={{ fontSize: '13px', color: '#1e40af', fontWeight: 600 }}>
                    You have not set a default delivery location. Set it now so future checkouts calculate quotes automatically without asking!
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('addresses')}
                  style={{
                    padding: '8px 16px',
                    background: '#4f46e5',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Set Location Now
                </button>
              </div>
            )}
          </div>

          {/* Personal Info & Security Form */}
          <div className={styles.card} style={{ padding: '32px' }}>
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                  <User size={20} /> Personal Information
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <label className={styles.label}>Full Name</label>
                    <input
                      className={styles.inputField}
                      value={profileData.name}
                      onChange={e => setProfileData({ ...profileData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className={styles.label}>Email Address</label>
                    <input
                      type="email"
                      className={styles.inputField}
                      value={profileData.email}
                      disabled
                      style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
                    />
                  </div>
                  <div>
                    <label className={styles.label}>Contact Number</label>
                    <input
                      type="text"
                      className={styles.inputField}
                      value={profileData.contactNumber}
                      onChange={e => setProfileData({ ...profileData, contactNumber: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 style={{ margin: '24px 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                  <Lock size={20} /> Security
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <label className={styles.label}>New Password</label>
                    <input
                      autoComplete="new-password"
                      type="password"
                      placeholder="Leave blank to keep current"
                      className={styles.inputField}
                      value={passwordData.password}
                      onChange={e => setPasswordData({ ...passwordData, password: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={styles.label}>Confirm New Password</label>
                    <input
                      autoComplete="new-password"
                      type="password"
                      placeholder="Leave blank to keep current"
                      className={styles.inputField}
                      value={passwordData.confirmPassword}
                      onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '24px' }}>
                <button
                  type="submit"
                  disabled={profileSaving}
                  style={{
                    background: '#4f46e5',
                    color: 'white',
                    border: 'none',
                    padding: '12px 32px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '15px',
                    cursor: profileSaving ? 'not-allowed' : 'pointer',
                    opacity: profileSaving ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                    transition: 'transform 0.2s'
                  }}
                >
                  <Save size={18} /> {profileSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: Delivery Location & Addresses */}
      {activeTab === 'addresses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Section 1: Set / Edit Delivery Location Form */}
          <div
            style={{
              background: '#fff',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={22} color="#4f46e5" />
                  <span>{editLocationId ? 'Edit Delivery Location' : 'Set Delivery Location'}</span>
                </h2>
                <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                  Pin your delivery destination on the map. This location will be saved to your account and automatically used for future orders.
                </p>
              </div>

              {editLocationId && (
                <button
                  type="button"
                  onClick={handleResetLocationForm}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  <RotateCcw size={14} /> Cancel Edit
                </button>
              )}
            </div>

            {/* Success alert message */}
            {locationSuccessMsg && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: '#166534',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                <CheckCircle2 size={18} color="#16a34a" />
                <span>{locationSuccessMsg}</span>
              </div>
            )}

            {/* Interactive Map Picker */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                Pick Location on Map *
              </label>
              <MapPicker
                initialLat={locationLat || undefined}
                initialLng={locationLng || undefined}
                initialAddress={locationAddress || undefined}
                initialLandmark={locationLandmark || undefined}
                onLocationSelect={res => {
                  setLocationAddress(res.address);
                  setLocationLat(res.lat);
                  setLocationLng(res.lng);
                  if (res.landmark !== undefined) setLocationLandmark(res.landmark);
                }}
              />
            </div>

            {/* Form */}
            <form onSubmit={handleSaveLocation} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Set as Default Checkbox */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  padding: '12px 16px',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  width: 'fit-content'
                }}
              >
                <input
                  type="checkbox"
                  checked={isDefaultLocation}
                  onChange={e => setIsDefaultLocation(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#4f46e5', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                  Set as default delivery address for future orders
                </span>
              </label>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '18px' }}>
                {editLocationId && (
                  <button
                    type="button"
                    onClick={handleResetLocationForm}
                    style={{
                      padding: '12px 20px',
                      background: '#fff',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="submit"
                  disabled={savingLocation || !locationLat || !locationLng}
                  style={{
                    background: savingLocation || !locationLat || !locationLng ? '#94a3b8' : '#4f46e5',
                    color: 'white',
                    border: 'none',
                    padding: '12px 32px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '15px',
                    cursor: savingLocation || !locationLat || !locationLng ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                    transition: 'all 0.2s'
                  }}
                >
                  {savingLocation ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Saving Location...
                    </>
                  ) : (
                    <>
                      <Save size={18} /> {editLocationId ? 'Update Location' : 'Set & Save Location'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Saved Delivery Addresses List */}
          <div
            style={{
              background: '#fff',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                  Saved Addresses ({savedLocations.length})
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  Manage your saved locations or switch your default delivery destination.
                </p>
              </div>
            </div>

            {locationsLoading ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#64748b', fontSize: '14px' }}>
                Loading saved locations...
              </div>
            ) : savedLocations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                <MapPin size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <h4 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '16px' }}>No Saved Locations Yet</h4>
                <p style={{ maxWidth: '400px', margin: '0 auto', fontSize: '13px' }}>
                  Use the map above to set your first delivery location. It will automatically be used for your upcoming orders!
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                {savedLocations.map((loc: any, idx: number) => {
                  const isDef = Boolean(loc.isDefault);
                  return (
                    <div
                      key={loc.id || idx}
                      style={{
                        background: isDef ? '#f8fafc' : '#ffffff',
                        borderRadius: '16px',
                        border: isDef ? '2px solid #818cf8' : '1px solid #e2e8f0',
                        padding: '18px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '14px',
                        position: 'relative'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={18} color="#4f46e5" />
                            {loc.address ? loc.address.split(',')[0] : (loc.landmark || 'Delivery Address')}
                          </span>
                          {isDef && (
                            <span
                              style={{
                                background: '#dcfce7',
                                color: '#15803d',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '999px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <CheckCircle2 size={12} /> Default
                            </span>
                          )}
                        </div>

                        <p style={{ fontSize: '13px', color: '#334155', margin: '0 0 6px 0', lineHeight: 1.4 }}>
                          {loc.address}
                        </p>

                        {loc.landmark && (
                          <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Navigation size={12} color="#4f46e5" />
                            <span>Landmark: <strong>{loc.landmark}</strong></span>
                          </div>
                        )}

                        {loc.lat && loc.lng && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                            Coordinates: {Number(loc.lat).toFixed(4)}, {Number(loc.lng).toFixed(4)}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                        <div>
                          {!isDef && (
                            <button
                              type="button"
                              onClick={() => handleSetDefaultLocation(loc.id || loc.locationName)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 12px',
                                background: '#fff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#4f46e5',
                                cursor: 'pointer'
                              }}
                            >
                              <Star size={12} /> Set Default
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleEditLocation(loc)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 12px',
                              background: '#fff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#334155',
                              cursor: 'pointer'
                            }}
                          >
                            <Edit2 size={12} /> Edit on Map
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLocation(loc.id || loc.locationName)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 10px',
                              background: '#fff',
                              border: '1px solid #fecaca',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#dc2626',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
