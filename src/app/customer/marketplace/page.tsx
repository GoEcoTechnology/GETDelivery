'use client';
import { useState, useEffect } from 'react';
import { Search, ShoppingCart, Minus, Plus, Package, X, Store, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import CheckoutModal from '@/components/CheckoutModal';

export default function MarketplacePage() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const categories = ['All', 'Food', 'Grocery', 'Bakery', 'Beverages', 'Hardware', 'Pharmacy', 'Electronics', 'Others'];

  // Modal state
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null); // which size/variant is active
  const [selectedSellingUnit, setSelectedSellingUnit] = useState<any>(null); // which selling unit is active
  const [cartQuantity, setCartQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [directCheckoutItems, setDirectCheckoutItems] = useState<any[]>([]);

  // Derived price — use variant price if variant selected, else base product price
  let activePrice = selectedVariant?.price != null
    ? Number(selectedVariant.price)
    : selectedProduct ? Number(selectedProduct.price) : 0;
    
  if (selectedSellingUnit) {
    if (selectedSellingUnit.price != null && Number(selectedSellingUnit.price) > 0) {
      activePrice = Number(selectedSellingUnit.price); // Use override price if set
    } else {
      activePrice = activePrice * Number(selectedSellingUnit.equivalentQty); // Otherwise multiply base price
    }
  }

  const selectedVariantUnits = selectedVariant?.sellingUnits || [];
  const selectedStock = selectedVariant
    ? Number(selectedVariant.stock || 0)
    : Number(selectedProduct?.stock || 0);
  const selectedAvailable = selectedSellingUnit
    ? Math.floor(selectedStock / (Number(selectedSellingUnit.equivalentQty) || 1))
    : selectedStock;

  const openProductModal = (product: any) => {
    setSelectedProduct(product);
    // Pre-select first variant if any
    const firstVariant = product.variants?.length > 0 ? product.variants[0] : null;
    setSelectedVariant(firstVariant);
    
    // Default to base piece
    setSelectedSellingUnit(null);
    
    setCartQuantity(1);
  };

  const closeModal = () => {
    setSelectedProduct(null);
    setSelectedVariant(null);
    setSelectedSellingUnit(null);
    setCartQuantity(1);
  };

  const handleConfirmAddToCart = async () => {
    try {
      setIsAddingToCart(true);
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (!user || !user.id) { alert('Please log in to add items to your cart.'); return; }

      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: user.id, productId: selectedVariant ? selectedVariant.id : selectedProduct.id, sellingUnitId: selectedSellingUnit?.id, quantity: cartQuantity }),
      });

      if (res.ok) { closeModal(); alert('Added to cart!'); }
      else { const err = await res.json(); alert('Failed to add: ' + (err.error || res.statusText)); }
    } catch (err: any) { alert('Error: ' + err.message); }
    finally { setIsAddingToCart(false); }
  };

  const handleCheckoutNow = async () => {
    try {
      setIsAddingToCart(true);
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (!user || !user.id) { alert('Please log in first.'); setIsAddingToCart(false); return; }

      const tempItem = {
        id: null,
        quantity: cartQuantity,
        product: {
          id: selectedProduct.id,
          name: selectedVariant ? selectedVariant.variantName : selectedProduct.name,
          parentName: selectedProduct.name,
          price: selectedVariant ? selectedVariant.price : selectedProduct.price,
          tenantId: selectedProduct.tenantId,
          tenantName: 'Store',
          variantId: selectedVariant ? selectedVariant.id : null,
          unit: selectedVariant ? selectedVariant.unit : 'piece',
        },
        sellingUnit: selectedSellingUnit ? {
          id: selectedSellingUnit.id,
          name: selectedSellingUnit.unitName,
          price: selectedSellingUnit.price
        } : null
      };

      setDirectCheckoutItems([tempItem]);
      setIsCheckoutModalOpen(true);
      setIsAddingToCart(false);
    } catch (err: any) { alert('Error: ' + err.message); setIsAddingToCart(false); }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        const res = await fetch('/api/marketplace/products');
        if (res.ok) {
          const data = await res.json();
          setProducts(data.map((p: any) => ({
            ...p,
            category: p.category || 'Others',
            stock: p.stock ?? 0,
            // Simulate variants for products that don't have them yet (demo only)
            variants: p.variants || [],
          })));
        }
        if (user?.id) {
          const cartRes = await fetch(`/api/cart?customerId=${user.id}`);
          if (cartRes.ok) setCartItems(await cartRes.json());
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  // Filter
  const filtered = products.filter(p => {
    const matchCat = activeCategory === 'All' || p.category === activeCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '64px' }}>

      {/* Search + Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '220px', maxWidth: '380px' }}>
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '11px 16px 11px 38px', borderRadius: '999px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '14px', color: '#334155', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}
          />
          <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
        </div>



        {cartCount > 0 && (
          <button onClick={() => router.push('/customer/cart')} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: '999px', background: '#FF5A2C', color: 'white', border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer', flexShrink: 0 }}>
            <ShoppingCart size={16} /> Cart ({cartCount})
          </button>
        )}
      </div>

      {/* Products grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#4f46e5', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '20px', padding: '60px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <Package size={48} color="#cbd5e1" style={{ margin: '0 auto' }} />
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginTop: 16 }}>No products found</div>
          <div style={{ color: '#64748b', marginTop: 4 }}>Try adjusting your search or category.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {filtered.map(product => {
            const hasVariants = product.variants?.length > 0;
            const hasSellingUnits = product.variants?.some((v: any) => v.sellingUnits?.length > 0);
            const hasOptions = hasVariants || hasSellingUnits;
            const lowestPrice = hasVariants
              ? Math.min(...product.variants.map((v: any) => Number(v.price || 0)))
              : Number(product.price || 0);

            return (
              <div
                key={product.id}
                onClick={() => openProductModal(product)}
                style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(15,23,42,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.05)'; }}
              >
                {/* Stock badge + name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 800, background: product.stock > 0 ? '#dcfce7' : '#fee2e2', color: product.stock > 0 ? '#16a34a' : '#ef4444', borderRadius: '999px', textTransform: 'uppercase' }}>
                      {product.stock > 0 ? 'Available' : 'Out of Stock'}
                    </span>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>{product.name}</div>
                  <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>{product.category || 'General'}</div>
                </div>



                {/* Price + CTA */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{hasOptions ? 'Starting at' : 'Price'}</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                      <span style={{ fontSize: 14, marginRight: 1 }}>₱</span>
                      {lowestPrice % 1 === 0 ? lowestPrice.toFixed(0) : lowestPrice.toFixed(2)}
                    </div>
                  </div>
                  <button
                    disabled={product.stock <= 0}
                    onClick={e => { e.stopPropagation(); openProductModal(product); }}
                    style={{ color: '#fff', fontWeight: 700, background: product.stock > 0 ? '#FF5A2C' : '#cbd5e1', border: 'none', cursor: product.stock > 0 ? 'pointer' : 'not-allowed', fontSize: '13px', padding: '10px 18px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.2s' }}
                    onMouseEnter={e => { if (product.stock > 0) e.currentTarget.style.background = '#e04f26'; }}
                    onMouseLeave={e => { if (product.stock > 0) e.currentTarget.style.background = '#FF5A2C'; }}
                  >
                    <ShoppingCart size={15} />
                    {hasOptions ? 'Select Options' : 'Add to Cart'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Clean Product Detail Modal ── */}
      {selectedProduct && (() => {
        const formatPrice = (p: number | string) => {
          const num = Number(p || 0);
          return num % 1 === 0 ? num.toFixed(0) : num.toFixed(2);
        };
        
        return (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px', animation: 'fadeIn 0.2s ease-out' }}
          onClick={closeModal}
        >
          <div
            style={{ background: '#ffffff', borderRadius: '24px', width: '100%', maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '0', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15)', overflow: 'hidden', transform: 'scale(1)', animation: 'slideUp 0.25s ease-out' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ padding: '24px 32px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ padding: '4px 10px', background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 700, borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {selectedProduct.category || 'General'}
                  </span>
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>{selectedAvailable} in stock</span>
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>{selectedProduct.name}</h2>
              </div>
              <button onClick={closeModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', marginTop: '-4px', marginRight: '-8px' }} onMouseEnter={e => e.currentTarget.style.color = '#0f172a'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            <div style={{ padding: '32px', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '40px', overflowY: 'auto', maxHeight: '60vh' }}>
              
              {/* Left Column: Options */}
              <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Variant/Size selector */}
                {selectedProduct.variants?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Size</div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {selectedProduct.variants.map((v: any) => {
                        const isActive = selectedVariant?.id === v.id || selectedVariant?.variantName === v.variantName;
                        return (
                          <button
                            key={v.id || v.variantName}
                            type="button"
                            onClick={() => {
                              setSelectedVariant(v);
                              setSelectedSellingUnit(null);
                            }}
                            style={{
                              padding: '10px 16px', borderRadius: '10px',
                              border: `1px solid ${isActive ? '#4f46e5' : '#e2e8f0'}`,
                              background: isActive ? '#eef2ff' : 'white',
                              color: isActive ? '#4f46e5' : '#475569',
                              fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                              transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                          >
                            <span>{v.variantName}</span>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: isActive ? '#4f46e5' : '#94a3b8' }}>₱{formatPrice(v.price)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Selling Unit selector */}
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Unit</div>
                  {selectedVariantUnits.length > 0 ? (
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedSellingUnit(null)}
                        style={{
                          padding: '10px 16px', borderRadius: '10px',
                          border: `1px solid ${!selectedSellingUnit ? '#4f46e5' : '#e2e8f0'}`,
                          background: !selectedSellingUnit ? '#eef2ff' : 'white',
                          color: !selectedSellingUnit ? '#4f46e5' : '#475569',
                          fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                          transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                      >
                        <span>{selectedVariant?.unit || 'Piece'}</span>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: !selectedSellingUnit ? '#4f46e5' : '#94a3b8' }}>x1</span>
                      </button>

                      {selectedVariantUnits.filter((u: any) => Number(u.equivalentQty) !== 1).map((u: any) => {
                        const isActive = selectedSellingUnit?.id === u.id;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => setSelectedSellingUnit(u)}
                            style={{
                              padding: '10px 16px', borderRadius: '10px',
                              border: `1px solid ${isActive ? '#4f46e5' : '#e2e8f0'}`,
                              background: isActive ? '#eef2ff' : 'white',
                              color: isActive ? '#4f46e5' : '#475569',
                              fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                              transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                          >
                            <span>{u.unitName}</span>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: isActive ? '#4f46e5' : '#94a3b8' }}>x{u.equivalentQty}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: '10px', color: '#64748b', fontSize: '13px', border: '1px dashed #cbd5e1' }}>
                      No additional selling units available for this size.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Summary & Quantity */}
              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '24px', background: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                
                {/* Price display */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Unit Price</span>
                  <span style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                    ₱{formatPrice(activePrice)}
                  </span>
                </div>

                {/* Quantity selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Quantity</span>
                  <div style={{ display: 'inline-flex', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px', width: 'fit-content' }}>
                    <button onClick={() => setCartQuantity(q => Math.max(1, q - 1))} style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <Minus size={16} strokeWidth={2} />
                    </button>
                    <input 
                      type="number" 
                      min="1" 
                      max={selectedAvailable || 99}
                      value={cartQuantity} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val > 0) {
                          setCartQuantity(Math.min(selectedAvailable || 99, val));
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value === '' || parseInt(e.target.value) < 1) setCartQuantity(1);
                      }}
                      style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', width: '50px', textAlign: 'center', border: 'none', outline: 'none', background: 'transparent' }}
                    />
                    <button onClick={() => setCartQuantity(q => Math.min(selectedAvailable || 99, q + 1))} style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <Plus size={16} strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {/* Total */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Total Amount</span>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: '#4f46e5' }}>
                    ₱{formatPrice(activePrice * cartQuantity)}
                  </span>
                </div>
              </div>
            </div>

            {/* CTA buttons */}
            <div style={{ padding: '20px 32px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '16px', background: '#fff', flexWrap: 'wrap' }}>
              <button
                disabled={isAddingToCart}
                onClick={handleConfirmAddToCart}
                style={{ flex: 1, minWidth: '200px', padding: '14px', background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: isAddingToCart ? 'not-allowed' : 'pointer', opacity: isAddingToCart ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.15s' }}
                onMouseEnter={e => { if (!isAddingToCart) { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; } }}
                onMouseLeave={e => { if (!isAddingToCart) { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; } }}
              >
                <ShoppingCart size={18} /> {isAddingToCart ? 'Adding...' : 'Add to Cart'}
              </button>
              <button
                disabled={isAddingToCart}
                onClick={handleCheckoutNow}
                style={{ flex: 1, minWidth: '200px', padding: '14px', background: '#FF5A2C', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: isAddingToCart ? 'not-allowed' : 'pointer', opacity: isAddingToCart ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.15s' }}
                onMouseEnter={e => { if (!isAddingToCart) { e.currentTarget.style.background = '#e04f26'; } }}
                onMouseLeave={e => { if (!isAddingToCart) { e.currentTarget.style.background = '#FF5A2C'; } }}
              >
                {isAddingToCart ? 'Processing...' : 'Buy & Checkout Now'}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      <CheckoutModal 
        isOpen={isCheckoutModalOpen} 
        onClose={() => setIsCheckoutModalOpen(false)} 
        tenantId={directCheckoutItems[0]?.product?.tenantId || null} 
        directItems={directCheckoutItems} 
      />
    </div>
  );
}
