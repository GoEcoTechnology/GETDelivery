'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Store, Truck, CheckCircle2, ChevronRight, RotateCcw } from 'lucide-react';

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');

  const tabs = ['All', 'To Pay', 'To Ship', 'To Receive', 'Completed', 'Cancelled'];

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (!user || !user.id) {
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/customer/orders?customerId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'WAITING_FOR_PARTNER': return 'To Receive';
      case 'ACCEPTED': return 'To Receive';
      case 'IN_TRANSIT': return 'To Receive';
      case 'DELIVERED': return 'Completed';
      case 'COMPLETED': return 'Completed';
      case 'CANCELLED': return 'Cancelled';
      default: return 'To Pay';
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'DRAFT': return 'text-yellow-600';
      case 'WAITING_FOR_PARTNER': return 'text-blue-600';
      case 'COMPLETED':
      case 'DELIVERED': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '64px' }}>

      {/* Header (Desktop) */}


      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0' }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              borderBottom: activeTab === tab ? '3px solid #4f46e5' : '3px solid transparent',
              color: activeTab === tab ? '#4f46e5' : '#64748b',
              background: 'none',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ width: '100%' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '80px 0' }}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4f46e5]"></div>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '48px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', textAlign: 'center' }}>
            <Package size={48} color="#cbd5e1" style={{ margin: '0 auto' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: '16px' }}>No orders yet</h3>
            <Link href="/customer/marketplace" style={{ display: 'inline-block', marginTop: '16px', padding: '12px 24px', background: '#4f46e5', color: '#fff', borderRadius: '999px', fontWeight: 700, textDecoration: 'none' }}>
              Start Shopping
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {orders.map((order) => (
              <div key={order.id} style={{
                background: '#fff',
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'pointer'
              }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)';
                }}>

                {/* Top Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                    <span style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 800,
                      background: ['COMPLETED', 'DELIVERED'].includes(order.status) ? '#dcfce7' : ['PENDING'].includes(order.status) ? '#ffedd5' : '#dbeafe',
                      color: ['COMPLETED', 'DELIVERED'].includes(order.status) ? '#16a34a' : ['PENDING'].includes(order.status) ? '#ea580c' : '#2563eb',
                      borderRadius: '999px',
                      textTransform: 'uppercase'
                    }}>
                      {getStatusText(order.status)}
                    </span>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, fontFamily: 'monospace' }}>
                      #{order.id}
                    </div>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', lineHeight: 1.3, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Store size={16} color="#475569" />
                    {order.tenantName}
                  </div>
                </div>

                {/* Middle Section (Items) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', background: '#f8fafc', borderRadius: '12px', marginTop: '4px' }}>
                  {order.items && order.items.map((item: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: idx < order.items.length - 1 ? '1px solid #e2e8f0' : 'none', paddingBottom: idx < order.items.length - 1 ? '8px' : '0' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: '#0f172a', fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                          {item.productName}
                        </span>
                        <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 500 }}>Qty: {item.quantity}</span>
                      </div>
                      <div style={{ color: '#0f172a', fontSize: '14px', fontWeight: 800 }}>
                        ₱{Number(item.price || 0).toFixed(2)}
                      </div>
                    </div>
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '12px', marginTop: '4px' }}>
                    <div style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Total Order</div>
                    <div style={{ color: '#4f46e5', fontSize: '18px', fontWeight: 800 }}>
                      <span style={{ fontSize: '14px', marginRight: '2px' }}>₱</span>{Number(order.totalAmount).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Bottom Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                  <button style={{
                    color: '#64748b',
                    fontWeight: 700,
                    background: 'transparent',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    fontSize: '13px',
                    padding: '8px 16px',
                    borderRadius: '999px',
                    transition: 'all 0.2s'
                  }}>
                    Contact
                  </button>
                  <button style={{
                    color: order.status === 'COMPLETED' ? '#4f46e5' : '#fff',
                    fontWeight: 700,
                    background: order.status === 'COMPLETED' ? '#e0e7ff' : '#4f46e5',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    padding: '8px 20px',
                    borderRadius: '999px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'background 0.2s'
                  }}>
                    {order.status === 'COMPLETED' ? 'Buy Again' : 'Track'} <ChevronRight size={16} />
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
