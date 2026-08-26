'use client';
import { Package, Clock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import styles from '../admin.module.css';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export default function DashboardCharts({ initialChartData }: { initialChartData: any }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginTop: '24px' }}>
      
      {/* Main Chart: Deliveries Over Time */}
      <div className={styles.card}>
        <h3 style={{ marginBottom: '24px' }}>Deliveries Over Time</h3>
        <div style={{ height: '300px' }}>
          {initialChartData.deliveriesPerDay.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={initialChartData.deliveriesPerDay} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
              <Package size={48} style={{ opacity: 0.5, marginBottom: '12px' }} />
              <p>No delivery data for this period.</p>
            </div>
          )}
        </div>
      </div>

      {/* Secondary Chart: Status Distribution */}
      <div className={styles.card}>
        <h3 style={{ marginBottom: '24px' }}>Delivery Status</h3>
        <div style={{ height: '300px' }}>
          {initialChartData.statusDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={initialChartData.statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {initialChartData.statusDistribution.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
              </PieChart>
            </ResponsiveContainer>
          ) : (
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
              <Clock size={48} style={{ opacity: 0.5, marginBottom: '12px' }} />
              <p>No status data available.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
