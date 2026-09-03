'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Bell, Info } from 'lucide-react';

type NotificationItem = {
  id: number;
  title: string;
  body: string;
  status: 'UNREAD' | 'READ' | string;
  createdAt: string;
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch('/api/notifications?limit=5', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      const items = (data.notifications || []) as NotificationItem[];
      setNotifications(items);
      setUnreadCount(items.filter((n) => n.status === 'UNREAD').length || 0);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchNotifications();
      intervalRef.current = setInterval(fetchNotifications, 30000);
    }, 0);
    return () => {
      clearTimeout(timer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNotifications]);

  const markNotificationsRead = async (notificationIds: number[]) => {
    const previous = notifications;
    setNotifications(prev => prev.map(n => notificationIds.includes(n.id) ? { ...n, status: 'READ' } : n));
    setUnreadCount(prev => Math.max(0, prev - notificationIds.length));

    try {
      const token = localStorage.getItem('token');
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notificationIds, action: 'mark_read' })
      });
      await fetchNotifications();
    } catch (err) {
      console.error(err);
      setNotifications(previous);
      setUnreadCount(previous.filter((n) => n.status === 'UNREAD').length);
    }
  };

  const unreadIds = notifications.filter(n => n.status === 'UNREAD').map(n => n.id);

  return (
    <div style={{ position: 'relative', zIndex: 60 }} ref={dropdownRef}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
        aria-label="Notifications"
      >
        <div style={{ padding: '8px', backgroundColor: '#f1f5f9', borderRadius: '50%', position: 'relative' }}>
          <Bell size={20} />
          {unreadCount > 0 && (
            <span style={{ position: 'absolute', top: 0, right: 0, background: '#ef4444', color: 'white', fontSize: '10px', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              {unreadCount}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 10px)',
          right: 0,
          width: '340px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(15,23,42,0.18)',
          border: '1px solid #e2e8f0',
          zIndex: 9999,
          overflow: 'hidden'
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Notifications</h3>
            {unreadIds.length > 0 && (
              <button
                onClick={() => markNotificationsRead(unreadIds)}
                style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                Mark all as read
              </button>
            )}
          </div>

          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '13px' }}>
                <Bell size={24} style={{ marginBottom: '8px', opacity: 0.2 }} />
                <span>No notifications yet</span>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  style={{
                    padding: '16px',
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: notif.status === 'UNREAD' ? '#f8fafc' : 'white',
                    display: 'flex',
                    gap: '12px',
                    transition: 'background-color 0.2s',
                    position: 'relative',
                    cursor: notif.status === 'UNREAD' ? 'pointer' : 'default'
                  }}
                  onClick={() => notif.status === 'UNREAD' && markNotificationsRead([notif.id])}
                >
                  <div style={{ flexShrink: 0, marginTop: '2px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: notif.status === 'UNREAD' ? '#e0e7ff' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: notif.status === 'UNREAD' ? '#4f46e5' : '#94a3b8' }}>
                      <Info size={16} />
                    </div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    {notif.title && <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#0f172a', fontWeight: 700 }}>{notif.title}</h4>}
                    <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#1e293b', fontWeight: notif.status === 'UNREAD' ? 600 : 400, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                      {notif.body}
                    </p>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {new Date(notif.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  {notif.status === 'UNREAD' && (
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4f46e5', alignSelf: 'center' }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
