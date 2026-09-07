'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../../../admin/admin.module.css';
import { ArrowLeft, TrendingDown, PackageMinus, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export default function StockOutAnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/inventory/stock-out/analytics', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    })
      .then(res => res.json())
      .then(result => {
        setData(result);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'];

  return (
    <div>
            <ArrowLeft size={16} /> Back to Inventory
          </button>
          <h1>Stock Out Analytics</h1>
          <p>Analyze inventory stock out trends and reasons</p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading analytics...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
            <div className={styles.card} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ padding: '16px', backgroundColor: '#fee2e2', color: '#ef4444', borderRadius: '12px' }}>
                <TrendingDown size={32} />
              </div>
              <div>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px', fontWeight: 600 }}>Total Out Today</p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '28px', color: '#0f172a' }}>{data?.todayCount || 0} items</h3>
              </div>
            </div>
            
            <div className={styles.card} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ padding: '16px', backgroundColor: '#ffedd5', color: '#f97316', borderRadius: '12px' }}>
                <PackageMinus size={32} />
              </div>
              <div>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px', fontWeight: 600 }}>Total Out This Week</p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '28px', color: '#0f172a' }}>{data?.weekCount || 0} items</h3>
              </div>
            </div>
            
            <div className={styles.card} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ padding: '16px', backgroundColor: '#fef3c7', color: '#f59e0b', borderRadius: '12px' }}>
                <AlertTriangle size={32} />
              </div>
              <div>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px', fontWeight: 600 }}>Total Out This Month</p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '28px', color: '#0f172a' }}>{data?.monthCount || 0} items</h3>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
            {/* Stock Out by Reason Pie Chart */}
            <div className={styles.card}>
              <h3 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>Stock Out by Reason</h3>
              {data?.reasons?.length > 0 ? (
                <div style={{ height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.reasons}
                        dataKey="count"
                        nameKey="reason"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      >
                        {data.reasons.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} items`, 'Quantity']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                  No data available
                </div>
              )}
            </div>

            {/* Most Stocked Out Products Bar Chart */}
            <div className={styles.card}>
              <h3 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>Most Stocked Out Products</h3>
              {data?.topProducts?.length > 0 ? (
                <div style={{ height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.topProducts} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis dataKey="productName" type="category" width={100} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => [`${value} items`, 'Quantity']} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                  No data available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
