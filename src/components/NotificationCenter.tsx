'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import styles from './NotificationCenter.module.css';

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('All');
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?limit=20');
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.notifications.filter((n: any) => n.status === 'UNREAD').length);
      }
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Setup polling or wait for NotificationProvider to refresh it 
    // We will just fetch on mount and when opened for now to prevent polling
  }, []);

  const toggleDropdown = () => {
    if (!isOpen) {
      fetchNotifications(); // Refresh when opening
    }
    setIsOpen(!isOpen);
  };

  const markAsRead = async (id: number) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [id], action: 'mark_read' }),
      });
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleNotificationClick = async (notif: any) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds: [notif.id], action: 'mark_clicked' }),
    });
    setIsOpen(false);
    if (notif.actionUrl) {
      router.push(notif.actionUrl);
    }
  };

  const filteredNotifs = notifications.filter(n => {
    if (activeTab === 'Unread') return n.status === 'UNREAD';
    if (activeTab === 'Orders') return n.notificationType.includes('order');
    return true; // 'All'
  });

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button className={styles.bellButton} onClick={toggleDropdown}>
        <Bell size={24} color="var(--primary-color)" />
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <h3>Notifications</h3>
            <div className={styles.tabs}>
              {['All', 'Unread', 'Orders'].map(tab => (
                <button 
                  key={tab} 
                  className={activeTab === tab ? styles.activeTab : styles.tab}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.list}>
            {filteredNotifs.length === 0 ? (
              <div className={styles.empty}>No notifications found.</div>
            ) : (
              filteredNotifs.map(notif => (
                <div 
                  key={notif.id} 
                  className={`${styles.item} ${notif.status === 'UNREAD' ? styles.unreadItem : ''}`}
                >
                  <div className={styles.itemContent} onClick={() => handleNotificationClick(notif)}>
                    <h4>{notif.title}</h4>
                    <p>{notif.body}</p>
                    <small>{formatDistanceToNow(new Date(notif.createdAt))} ago</small>
                  </div>
                  {notif.status === 'UNREAD' && (
                    <button className={styles.markReadBtn} onClick={() => markAsRead(notif.id)} title="Mark as read">
                      <Check size={16} />
                    </button>
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
