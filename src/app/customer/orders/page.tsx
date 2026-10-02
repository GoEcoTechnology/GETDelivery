'use client';
import { formatCurrency } from '@/lib/formatCurrency';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Store, Truck, CheckCircle2, ChevronRight, RotateCcw, Info, Clock, X, UserCircle, Car, Phone } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any>(null);

  const tabs = ['All', 'Pending', 'To Receive', 'Completed', 'Cancelled'];

  useEffect(() => {
    fetchOrders();
  }, []);

  const [cancellingId, setCancellingId] = useState<number | null>(null);

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

  const handleCancelOrder = async (orderId: number) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    setCancellingId(orderId);
    try {
      const res = await fetch(`/api/customer/orders/${orderId}/cancel`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchOrders(); // Refresh orders after successful cancel
      } else {
        const data = await res.json();
        alert(`Failed to cancel: ${data.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while cancelling the order.');
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'Pending';
      case 'WAITING_FOR_PARTNER':
      case 'ACCEPTED':
      case 'IN_TRANSIT':
        return 'To Receive';
      case 'DELIVERED':
      case 'COMPLETED':
        return 'Completed';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        return 'To Receive';
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
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '64px', margin: '0 auto' }}>

      {/* Premium Tabs & Policy */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {tabs.map(tab => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: isActive ? 700 : 600,
                whiteSpace: 'nowrap',
                border: 'none',
                borderRadius: '999px',
                background: isActive ? '#4f46e5' : '#f8fafc',
                color: isActive ? 'white' : '#64748b',
                boxShadow: isActive ? '0 4px 12px rgba(79, 70, 229, 0.25)' : 'none',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {tab === 'All' && <Package size={16} />}
              {tab === 'To Receive' && <Truck size={16} />}
              {tab === 'Completed' && <CheckCircle2 size={16} />}
              {tab === 'Cancelled' && <RotateCcw size={16} />}
              {tab}
            </button>
          );
        })}
        </div>
        <div 
          style={{ position: 'relative' }} 
          onMouseEnter={() => document.getElementById('cancel-tooltip')!.style.display = 'block'}
          onMouseLeave={() => document.getElementById('cancel-tooltip')!.style.display = 'none'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: '#f1f5f9', padding: '8px 12px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
            <Info size={16} /> Cancellation Policy
          </div>
          <div id="cancel-tooltip" style={{ position: 'absolute', right: 0, top: '40px', background: '#1e293b', color: 'white', padding: '12px', borderRadius: '8px', fontSize: '13px', width: '280px', zIndex: 50, display: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' }}>
            Orders cannot be cancelled once they have been accepted or dispatched by the Business Owner. <br/><br/><strong>Note:</strong> Cancelled orders will be removed after a day.
          </div>
        </div>
      </div>

      <div style={{ width: '100%' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '120px 0' }}>
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#4f46e5]"></div>
          </div>
        ) : orders.filter(o => activeTab === 'All' || getStatusText(o.status) === activeTab).length === 0 ? (
          <div style={{ padding: '0', border: 'none' }}>
            <EmptyState
              icon={Package}
              title="No Orders Found"
              description="You have no orders in this category."
              actionButton={<Link href="/customer/marketplace" style={{ display: 'inline-block', padding: '12px 24px', background: '#4f46e5', color: '#fff', borderRadius: '999px', fontWeight: 700, textDecoration: 'none', transition: 'background 0.2s' }}>Start Shopping</Link>}
            />
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
            {orders.filter(o => activeTab === 'All' || getStatusText(o.status) === activeTab).map((order) => {
              const isUrgent = order.deliveryPriority === 'URGENT';
              return (
                <div key={order.id} style={{
                  background: '#fff',
                  borderRadius: '24px',
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.03), 0 2px 8px -2px rgba(15, 23, 42, 0.02)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden', height: '100%'
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.02)';
                    e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(15, 23, 42, 0.03), 0 2px 8px -2px rgba(15, 23, 42, 0.02)';
                    e.currentTarget.style.borderColor = 'rgba(226, 232, 240, 0.8)';
                  }}>

                  {isUrgent && (
                    <div style={{ position: 'absolute', top: 0, right: 0, background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white', padding: '6px 24px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px', transform: 'rotate(45deg) translate(30%, -100%)', transformOrigin: 'bottom right', width: '120px', textAlign: 'center', boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)' }}>
                      URGENT
                    </div>
                  )}

                  {/* Top Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                      <span style={{
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: 700,
                        background: ['COMPLETED', 'DELIVERED'].includes(order.status) ? '#f0fdf4' : ['DRAFT', 'WAITING_FOR_PARTNER'].includes(order.status) ? '#f8fafc' : '#eff6ff',
                        color: ['COMPLETED', 'DELIVERED'].includes(order.status) ? '#15803d' : ['DRAFT', 'WAITING_FOR_PARTNER'].includes(order.status) ? '#475569' : '#2563eb',
                        border: `1px solid ${['COMPLETED', 'DELIVERED'].includes(order.status) ? '#bbf7d0' : ['DRAFT', 'WAITING_FOR_PARTNER'].includes(order.status) ? '#e2e8f0' : '#bfdbfe'}`,
                        borderRadius: '999px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        {['COMPLETED', 'DELIVERED'].includes(order.status) && <CheckCircle2 size={14} />}
                        {['DRAFT', 'WAITING_FOR_PARTNER'].includes(order.status) && <Package size={14} />}
                        {['ACCEPTED', 'IN_TRANSIT'].includes(order.status) && <Truck size={14} />}
                        {getStatusText(order.status)}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
                        <Store size={20} color="#4f46e5" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Store</div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                          {order.tenantName}
                        </div>
                      </div>
                    </div>
                  </div>

                {/* Middle Section (Items) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', background: '#f8fafc', borderRadius: '16px', marginTop: '4px', border: '1px solid #f1f5f9' }}>
                  {order.items && order.items.map((item: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: idx < order.items.length - 1 ? '1px dashed #e2e8f0' : 'none', paddingBottom: idx < order.items.length - 1 ? '12px' : '0' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ color: '#0f172a', fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', height: '100%', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                          {item.productName}
                        </span>
                        <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 600 }}>Quantity: {item.quantity}</span>
                      </div>
                      <div style={{ color: '#0f172a', fontSize: '15px', fontWeight: 800 }}>
                        ₱{formatCurrency(item.price || 0)}
                      </div>
                    </div>
                  ))}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Products Subtotal</div>
                      <div style={{ color: '#0f172a', fontSize: '14px', fontWeight: 700 }}>
                        ₱{formatCurrency(order.totalAmount)}
                      </div>
                    </div>

                    {['WAITING_FOR_PARTNER', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'].includes(order.status) || order.finalDeliveryPrice ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Vehicle Base Fee</div>
                          <div style={{ color: '#0f172a', fontSize: '14px', fontWeight: 700 }}>
                            ₱{formatCurrency(order.vehicleBasePrice || 0)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>Distance ({Number(order.distanceKm || 0).toFixed(1)} km)</div>
                          <div style={{ color: '#0f172a', fontSize: '14px', fontWeight: 700 }}>
                            ₱{formatCurrency(Number(order.distanceKm || 0) * Number(order.pricePerKm || 0))}
                          </div>
                        </div>
                        {order.deliveryPriority === 'URGENT' && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ color: '#ef4444', fontSize: '13px', fontWeight: 700 }}>Urgent Fee</div>
                            <div style={{ color: '#ef4444', fontSize: '14px', fontWeight: 800 }}>
                              ₱{formatCurrency(order.urgentAdditionalFee || 0)}
                            </div>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #cbd5e1', paddingTop: '12px', marginTop: '4px' }}>
                          <div style={{ color: '#0f172a', fontSize: '14px', fontWeight: 700 }}>Shipping Total</div>
                          <div style={{ color: '#0f172a', fontSize: '14px', fontWeight: 800 }}>
                            ₱{formatCurrency(Number(order.vehicleBasePrice || 0) + (Number(order.distanceKm || 0) * Number(order.pricePerKm || 0)) + (order.deliveryPriority === 'URGENT' ? Number(order.urgentAdditionalFee || 0) : 0))}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', padding: '16px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                          <div style={{ color: '#1e3a8a', fontSize: '15px', fontWeight: 800 }}>Total Amount</div>
                          <div style={{ color: '#4f46e5', fontSize: '20px', fontWeight: 900 }}>
                            ₱{formatCurrency(Number(order.totalAmount) + Number(order.vehicleBasePrice || 0) + (Number(order.distanceKm || 0) * Number(order.pricePerKm || 0)) + (order.deliveryPriority === 'URGENT' ? Number(order.urgentAdditionalFee || 0) : 0))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {order.deliveryPriority === 'URGENT' && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ color: '#ef4444', fontSize: '13px', fontWeight: 700 }}>Urgent Fee</div>
                            <div style={{ color: '#ef4444', fontSize: '14px', fontWeight: 800 }}>
                              ₱{formatCurrency(order.urgentAdditionalFee || 0)}
                            </div>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #cbd5e1', paddingTop: '12px', marginTop: '4px' }}>
                          <div style={{ color: '#0f172a', fontSize: '14px', fontWeight: 700 }}>Shipping Total</div>
                          <div style={{ color: '#64748b', fontSize: '14px', fontWeight: 700 }}>
                            {order.deliveryPriority === 'URGENT' ? `₱${Number(order.urgentAdditionalFee || 0).toFixed(2)} + TBD` : 'TBD'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', padding: '16px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                          <div style={{ color: '#1e3a8a', fontSize: '15px', fontWeight: 800 }}>Total Amount</div>
                          <div style={{ color: '#4f46e5', fontSize: '18px', fontWeight: 900 }}>
                            ₱{formatCurrency(Number(order.totalAmount) + (order.deliveryPriority === 'URGENT' ? Number(order.urgentAdditionalFee || 0) : 0))} <span style={{ fontSize: '14px', color: '#6366f1', fontWeight: 700 }}>+ TBD</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Bottom Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button style={{
                      color: '#475569',
                      fontWeight: 700,
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer',
                      fontSize: '13px',
                      padding: '8px 18px',
                      borderRadius: '999px',
                      transition: 'all 0.2s',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                    >
                      Contact
                    </button>
                    {['DRAFT', 'WAITING_FOR_PARTNER'].includes(order.status) && (
                      <button 
                        onClick={() => handleCancelOrder(order.id)}
                        disabled={cancellingId === order.id}
                        style={{
                          color: '#b91c1c',
                          fontWeight: 700,
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          cursor: cancellingId === order.id ? 'not-allowed' : 'pointer',
                          fontSize: '13px',
                          padding: '8px 18px',
                          borderRadius: '999px',
                          transition: 'all 0.2s',
                          opacity: cancellingId === order.id ? 0.7 : 1,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                        onMouseEnter={e => { if(cancellingId !== order.id) e.currentTarget.style.background = '#fee2e2' }}
                        onMouseLeave={e => { if(cancellingId !== order.id) e.currentTarget.style.background = '#fef2f2' }}
                      >
                        {cancellingId === order.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    )}
                  </div>
                  {order.status !== 'CANCELLED' && (
                  <button 
                    onClick={() => setSelectedOrderDetails(order)}
                    style={{
                      color: order.status === 'COMPLETED' ? '#4f46e5' : '#fff',
                      fontWeight: 700,
                      background: order.status === 'COMPLETED' ? '#e0e7ff' : '#4f46e5',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      padding: '8px 24px',
                      borderRadius: '999px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s',
                      boxShadow: order.status === 'COMPLETED' ? 'none' : '0 4px 12px rgba(79, 70, 229, 0.3)'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    View Details <ChevronRight size={16} />
                  </button>
                  )}
                </div>

              </div>
            )})}
          </div>
        )}
      </div>

      {selectedOrderDetails && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '24px'
        }} onClick={() => setSelectedOrderDetails(null)}>
          <div style={{
            background: 'white',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '500px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            animation: 'modalFadeIn 0.2s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ background: '#f8fafc', padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Order Assignment Details</h2>
              <button onClick={() => setSelectedOrderDetails(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>
            
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Business Owner Section */}
              {selectedOrderDetails.businessOwner && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <Store size={16} /> Business Owner
                  </div>
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{selectedOrderDetails.businessOwner.name}</div>
                    <div style={{ fontSize: '14px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={14} /> {selectedOrderDetails.businessOwner.contactNumber}</div>
                  </div>
                </div>
              )}

              {/* Partner Details Section */}
              {selectedOrderDetails.partnerDetails ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <Truck size={16} /> Delivery Partner
                  </div>
                  <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '16px', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e3a8a' }}>{selectedOrderDetails.partnerDetails.name}</div>
                      {selectedOrderDetails.partnerDetails.contact && (
                        <div style={{ fontSize: '14px', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}><Phone size={14} /> {selectedOrderDetails.partnerDetails.contact}</div>
                      )}
                    </div>
                    
                    <div style={{ borderTop: '1px dashed #93c5fd', margin: '4px 0' }}></div>
                    
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#60a5fa', textTransform: 'uppercase', marginBottom: '4px' }}>Assigned Driver / Fleet</div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}><UserCircle size={16} /> {selectedOrderDetails.partnerDetails.driverName || 'N/A'}</div>
                      <div style={{ fontSize: '14px', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}><Car size={14} /> {selectedOrderDetails.partnerDetails.vehicleDetails || selectedOrderDetails.partnerDetails.driverContact || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b', fontSize: '14px', fontWeight: 500 }}>
                  No delivery partner assigned yet.
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
