'use client';
import { useEffect, useState } from 'react';
import styles from '../../admin/admin.module.css';
import { Building2, Briefcase, Truck, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export default function PlatformDashboard() {
  const [stats, setStats] = useState({
    totalTenants: 0,
    totalPartners: 0,
    totalDeliveries: 0,
  });
  
  const [chartData, setChartData] = useState({
    statusDistribution: [],
    deliveriesPerDay: [],
  });
  
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('month');

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const statsRes = await fetch('/api/reports/dashboard');
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats({
            totalTenants: statsData.platform?.totalTenants || 0,
            totalPartners: statsData.platform?.totalPartners || 0,
            totalDeliveries: statsData.deliveries?.total || 0,
          });
        }

        const chartsRes = await fetch(`/api/reports/charts?range=${timeRange}`);
        if (chartsRes.ok) {
          const chartsJson = await chartsRes.json();
          
          const formattedPie = chartsJson.data.statusDistribution.map((s: any) => ({
            name: s.status,
            value: s.value
          }));
          
          setChartData({
            statusDistribution: formattedPie,
            deliveriesPerDay: chartsJson.data.deliveriesPerDay,
          });
        }
      } catch (error) {
        console.error('Failed to fetch platform dashboard data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [timeRange]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#64748b' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontWeight: 600 }}>Loading platform metrics...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Platform Overview</h1>
          <p>Global metrics across all tenants and logistics partners</p>
        </div>
        <div>
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className={styles.inputField}
            style={{ width: 'auto', fontWeight: 600 }}
          >
            <option value="week">Past Week</option>
            <option value="month">Past Month</option>
            <option value="year">Past Year</option>
          </select>
        </div>
      </div>
      
      {/* High-Level Stats Cards */}
      <div className={styles.grid}>
        <div className={styles.card} style={{ borderLeft: '4px solid #3b82f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registered Businesses</h3>
            <p style={{ color: '#1e293b', fontSize: '32px', margin: '8px 0 0 0' }}>{stats.totalTenants}</p>
          </div>
          <div style={{ backgroundColor: '#eff6ff', padding: '16px', borderRadius: '12px', color: '#3b82f6' }}>
            <Building2 size={28} />
          </div>
        </div>

        <div className={styles.card} style={{ borderLeft: '4px solid #10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Delivery Partners</h3>
            <p style={{ color: '#1e293b', fontSize: '32px', margin: '8px 0 0 0' }}>{stats.totalPartners}</p>
          </div>
          <div style={{ backgroundColor: '#ecfdf5', padding: '16px', borderRadius: '12px', color: '#10b981' }}>
            <Briefcase size={28} />
          </div>
        </div>

        <div className={styles.card} style={{ borderLeft: '4px solid #8b5cf6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Global Deliveries</h3>
            <p style={{ color: '#1e293b', fontSize: '32px', margin: '8px 0 0 0' }}>{stats.totalDeliveries}</p>
          </div>
          <div style={{ backgroundColor: '#f5f3ff', padding: '16px', borderRadius: '12px', color: '#8b5cf6' }}>
            <Truck size={28} />
          </div>
        </div>
      </div>

      {/* Dynamic Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginTop: '24px' }}>
        
        {/* Main Chart: Global Platform Activity */}
        <div className={styles.card}>
          <h3 style={{ marginBottom: '24px' }}>Global Platform Activity</h3>
          <div style={{ height: '300px' }}>
            {chartData.deliveriesPerDay.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.deliveriesPerDay} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                <Activity size={48} style={{ opacity: 0.5, marginBottom: '12px' }} />
                <p>No platform activity data for this period.</p>
              </div>
            )}
          </div>
        </div>

        {/* Secondary Chart: Status Distribution */}
        <div className={styles.card}>
          <h3 style={{ marginBottom: '24px' }}>Global Delivery Status</h3>
          <div style={{ height: '300px' }}>
            {chartData.statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                <Activity size={48} style={{ opacity: 0.5, marginBottom: '12px' }} />
                <p>No status data available.</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
