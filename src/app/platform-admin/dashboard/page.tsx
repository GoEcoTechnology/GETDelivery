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

  const [statsLoading, setStatsLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('month');

  useEffect(() => {
    const fetchDashboardData = () => {
      setStatsLoading(true);
      setChartsLoading(true);

      // Fetch Stats
      fetch('/api/reports/dashboard')
        .then(async (res) => {
          if (res.ok) {
            const statsData = await res.json();
            setStats({
              totalTenants: statsData.platform?.totalTenants || 0,
              totalPartners: statsData.platform?.totalPartners || 0,
              totalDeliveries: statsData.deliveries?.total || 0,
            });
          }
          setStatsLoading(false);
        })
        .catch(err => {
          console.error('Failed to fetch stats', err);
          setStatsLoading(false);
        });

      // Fetch Charts
      fetch(`/api/reports/charts?range=${timeRange}`)
        .then(async (res) => {
          if (res.ok) {
            const chartsJson = await res.json();
            const formattedPie = chartsJson.data.statusDistribution.map((s: any) => ({
              name: s.status,
              value: s.value
            }));
            setChartData({
              statusDistribution: formattedPie,
              deliveriesPerDay: chartsJson.data.deliveriesPerDay,
            });
          }
          setChartsLoading(false);
        })
        .catch(err => {
          console.error('Failed to fetch charts', err);
          setChartsLoading(false);
        });
    };

    fetchDashboardData();
  }, [timeRange]);

  return (
    <div>
      <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Platform Overview</h1>
          <p>Global metrics across all tenants and logistics partners</p>
        </div>
      </div>
        {/* High-Level Stats Cards */}
        <div className={styles.grid}>
          <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '14px', color: '#64748b', fontWeight: 600, margin: 0 }}>Registered Businesses</h3>
              <Building2 size={20} color="#94a3b8" />
            </div>
            <div>
              <p style={{ color: '#0f172a', fontSize: '32px', fontWeight: 700, margin: 0, lineHeight: 1 }}>{statsLoading ? '-' : stats.totalTenants}</p>
            </div>
          </div>

          <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '14px', color: '#64748b', fontWeight: 600, margin: 0 }}>Delivery Partners</h3>
              <Briefcase size={20} color="#94a3b8" />
            </div>
            <div>
              <p style={{ color: '#0f172a', fontSize: '32px', fontWeight: 700, margin: 0, lineHeight: 1 }}>{statsLoading ? '-' : stats.totalPartners}</p>
            </div>
          </div>

          <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '14px', color: '#64748b', fontWeight: 600, margin: 0 }}>Total Deliveries</h3>
              <Truck size={20} color="#94a3b8" />
            </div>
            <div>
              <p style={{ color: '#0f172a', fontSize: '32px', fontWeight: 700, margin: 0, lineHeight: 1 }}>{statsLoading ? '-' : stats.totalDeliveries}</p>
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
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
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
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
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
