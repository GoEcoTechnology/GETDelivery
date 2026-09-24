'use client';
import { useState, useEffect } from 'react';
import { Trash2, Store, Minus, Plus, ChevronRight, ShoppingCart, Search, Package } from 'lucide-react';
import Link from 'next/link';
import CheckoutModal from '@/components/CheckoutModal';

export default function CartPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutTenantId, setCheckoutTenantId] = useState<string | null>(null);

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (!user || !user.id) return;
      
      const res = await fetch(`/api/cart?customerId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (id: number) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: number, delta: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const setQuantityExact = (id: number, qty: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(1, qty) };
      }
      return item;
    }));
  };

  // Group items by tenant
  const itemsByTenant = items.reduce((acc: any, item: any) => {
    const tId = item.product.tenantId;
    if (!acc[tId]) {
      acc[tId] = {
        tenantName: item.product.tenantName,
        items: []
      };
    }
    acc[tId].items.push(item);
    return acc;
  }, {});

  const grandTotal = items.reduce((sum, item) => sum + (Number(item.sellingUnit?.price ?? item.product.price) * item.quantity), 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '80px 0', minHeight: '60vh' }}>
        <div style={{ 
          width: '32px', 
          height: '32px', 
          borderRadius: '50%', 
          borderBottom: '2px solid #4f46e5',
          animation: 'spin 1s linear infinite'
        }}></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ display: 'flex', flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '24px' }}>
        <div style={{
          background: '#fff',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          padding: '48px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center'
        }}>
          <div style={{ width: '80px', height: '80px', background: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
            <ShoppingCart size={40} color="#cbd5e1" />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Your Shopping Cart is Empty</h2>
          <p style={{ color: '#64748b', fontSize: '15px', margin: 0, marginBottom: '16px' }}>Looks like you haven't added anything to your cart yet.</p>
          <Link href="/customer/marketplace" style={{
            background: '#4f46e5',
            color: '#fff',
            fontWeight: 700,
            padding: '16px 32px',
            borderRadius: '999px',
            textDecoration: 'none',
            fontSize: '16px',
            transition: 'background 0.2s',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#4338ca'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#4f46e5'}
          >
            <Search size={20} /> Go Shopping Now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '64px' }}>
      
      {/* Header (Desktop) */}
      <div style={{ display: 'none' }}></div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'stretch', width: '100%' }}>
        
        {/* Items List */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {Object.keys(itemsByTenant).map((tenantId) => {
            const group = itemsByTenant[tenantId];
            return (
              <div key={tenantId} style={{
                background: '#fff',
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)'
              }}>
                
                {/* Seller Header */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
                  <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '10px' }}>
                    <Store size={20} color="#475569" />
                  </div>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{group.tenantName}</span>
                </div>
                
                {/* Items List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {group.items.map((item: any) => (
                    <div key={item.id} style={{ display: 'flex', gap: '16px', alignItems: 'center', background: '#f8fafc', padding: '12px 16px', borderRadius: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px', margin: 0 }}>
                          {item.sellingUnit?.name || 'Piece'} ({item.product.parentName ? `${item.product.parentName} - ${item.product.name}` : item.product.name})
                        </p>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                        <span style={{ color: '#0f172a', fontWeight: 800, fontSize: '15px', minWidth: '80px', textAlign: 'right' }}>₱{Number(item.sellingUnit?.price ?? item.product.price).toFixed(2)}</span>
                        
                        {/* Quantity Adjuster & Delete */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderRadius: '999px', border: '1px solid #e2e8f0', padding: '2px' }}>
                            <button onClick={() => updateQuantity(item.id, -1)} style={{ width: '28px', height: '28px', borderRadius: '50%', color: '#64748b', background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={14} /></button>
                            <input 
                              type="number" 
                              min="1" 
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val > 0) setQuantityExact(item.id, val);
                              }}
                              onBlur={(e) => {
                                if (e.target.value === '' || parseInt(e.target.value) < 1) setQuantityExact(item.id, 1);
                              }}
                              style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', width: '40px', textAlign: 'center', border: 'none', outline: 'none', background: 'transparent' }}
                            />
                            <button onClick={() => updateQuantity(item.id, 1)} style={{ width: '28px', height: '28px', borderRadius: '50%', color: '#64748b', background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={14} /></button>
                          </div>
                          <button onClick={() => removeItem(item.id)} style={{ color: '#94a3b8', background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'} onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}>
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Store Subtotal & Checkout */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '20px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Store Total:</span>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                      ₱{group.items.reduce((sum: number, i: any) => sum + (Number(i.sellingUnit?.price ?? i.product.price) * i.quantity), 0).toFixed(2)}
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      setCheckoutTenantId(tenantId);
                      setIsCheckoutModalOpen(true);
                    }}
                    style={{
                      background: '#FF5A2C',
                      color: '#fff',
                      fontWeight: 800,
                      padding: '12px 24px',
                      borderRadius: '999px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'background 0.2s, transform 0.1s',
                      boxShadow: '0 4px 6px rgba(255, 90, 44, 0.2)'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#e04f26'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#FF5A2C'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    Checkout <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <CheckoutModal isOpen={isCheckoutModalOpen} onClose={() => setIsCheckoutModalOpen(false)} tenantId={checkoutTenantId} />
    </div>
  );
}

function ShoppingCartIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"></circle>
      <circle cx="20" cy="21" r="1"></circle>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
    </svg>
  );
}
