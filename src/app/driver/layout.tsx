import '../admin/admin.module.css';
import PageGuideButton from '@/components/PageGuideModal';

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ backgroundColor: '#10b981', padding: '16px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
          DRIVER APP
          <PageGuideButton variant="driver" guideKey="driver-app" />
        </div>
      </header>
      <main style={{ flex: 1, padding: '16px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
        {children}
      </main>
    </div>
  );
}
