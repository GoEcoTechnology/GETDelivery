'use client';

import { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays } from 'date-fns';
import { useRouter } from 'next/navigation';

type DeliveryItem = {
  id: number;
  deliveryDate: Date | string | null;
  tenantName: string;
  pickupAddress: string;
  dropoffAddress: string;
  status?: string;
};

export default function DashboardCalendar({ deliveries }: { deliveries: DeliveryItem[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayDeliveries, setSelectedDayDeliveries] = useState<{date: string, deliveries: DeliveryItem[]} | null>(null);
  const router = useRouter();

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const dateFormat = "d";
  const rows = [];
  let days = [];
  let day = startDate;
  let formattedDate = "";

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, dateFormat);
      const cloneDay = day;
      
      const dayDeliveries = deliveries.filter(d => 
        d.deliveryDate && isSameDay(new Date(d.deliveryDate), cloneDay)
      );

      days.push(
        <div 
          key={day.toString()} 
          className="calendar-day"
          style={{
            minHeight: '80px',
            padding: '8px',
            border: '1px solid #e2e8f0',
            background: !isSameMonth(day, monthStart) ? '#f8fafc' : '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            minWidth: 0,
            cursor: 'pointer'
          }}
          onClick={() => {
            if (dayDeliveries.length > 0) {
              setSelectedDayDeliveries({ date: format(cloneDay, 'MMMM d, yyyy'), deliveries: dayDeliveries });
            }
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 600, color: !isSameMonth(day, monthStart) ? '#cbd5e1' : '#475569', textAlign: 'right' }}>
            {formattedDate}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', flex: 1 }}>
            {dayDeliveries.map(d => {
              let bg = '#e0e7ff';
              let border = '#c7d2fe';
              let textColor = '#3730a3';
              
              if (d.status === 'IN_TRANSIT') {
                bg = '#ede9fe'; border = '#c4b5fd'; textColor = '#5b21b6'; // Violet for IN_TRANSIT
              } else if (d.status === 'COMPLETED' || d.status === 'DELIVERED') {
                bg = '#dcfce7'; border = '#bbf7d0'; textColor = '#166534'; // Green for COMPLETED
              } else if (d.status === 'PENDING') {
                bg = '#f1f5f9'; border = '#e2e8f0'; textColor = '#475569'; // Gray for PENDING
              }

              return (
              <div 
                key={d.id} 
                onClick={() => router.push(`/partner/orders/${d.id}`)}
                className="calendar-item"
                style={{ 
                  background: bg, 
                  color: textColor, 
                  padding: '4px 6px', 
                  borderRadius: '6px', 
                  fontSize: '11px', 
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${border}`,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={`Delivery for ${d.tenantName}\nStatus: ${(d.status || 'Scheduled').replace(/_/g, ' ')}\nPickup: ${d.pickupAddress}\nDrop-off: ${d.dropoffAddress}`}
              >
                {d.tenantName}
              </div>
              );
            })}
          </div>
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div key={day.toString()} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days}
      </div>
    );
    days = [];
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div style={{ background: 'white', borderRadius: '18px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(15,23,42,0.06)', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CalendarIcon size={24} color="#4f46e5" />
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Delivery Schedule</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={prevMonth} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', width: '32px', height: '32px', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#475569' }}><ChevronLeft size={16} /></button>
          <div style={{ fontWeight: 700, color: '#0f172a', minWidth: '120px', textAlign: 'center' }}>
            {format(currentDate, "MMMM yyyy")}
          </div>
          <button onClick={nextMonth} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', width: '32px', height: '32px', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#475569' }}><ChevronRight size={16} /></button>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#e0e7ff', border: '1px solid #c7d2fe' }}></div> Accepted/Assigned
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#ede9fe', border: '1px solid #c4b5fd' }}></div> In Transit
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#dcfce7', border: '1px solid #bbf7d0' }}></div> Completed
        </div>
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflowX: 'auto' }}>
        <div style={{ minWidth: '600px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {weekDays.map(wd => (
              <div key={wd} style={{ padding: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                {wd}
              </div>
            ))}
          </div>
          <div>{rows}</div>
        </div>
      </div>

      {selectedDayDeliveries && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }} onClick={() => setSelectedDayDeliveries(null)}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Deliveries for {selectedDayDeliveries.date}</h2>
              <button onClick={() => setSelectedDayDeliveries(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {selectedDayDeliveries.deliveries.map(d => {
                let bg = '#e0e7ff';
                let border = '#c7d2fe';
                let textColor = '#3730a3';
                
                if (d.status === 'IN_TRANSIT') {
                  bg = '#ede9fe'; border = '#c4b5fd'; textColor = '#5b21b6';
                } else if (d.status === 'COMPLETED' || d.status === 'DELIVERED') {
                  bg = '#dcfce7'; border = '#bbf7d0'; textColor = '#166534';
                } else if (d.status === 'PENDING') {
                  bg = '#f1f5f9'; border = '#e2e8f0'; textColor = '#475569';
                }

                return (
                  <div key={d.id} onClick={() => router.push(`/partner/orders/${d.id}`)} style={{ cursor: 'pointer', padding: '16px', borderRadius: '12px', border: `1px solid ${border}`, background: bg }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong style={{ color: textColor }}>{d.tenantName}</strong>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: textColor, padding: '4px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.6)' }}>
                        {(d.status || 'Scheduled').replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: textColor, opacity: 0.9 }}>
                      <div style={{ marginBottom: '4px' }}><strong style={{ opacity: 0.8 }}>Pickup:</strong> {d.pickupAddress}</div>
                      <div><strong style={{ opacity: 0.8 }}>Drop-off:</strong> {d.dropoffAddress}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
