import '../admin/admin.module.css'; // Just using some globals from there if needed

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ backgroundColor: '#ffffff', padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ fontWeight: 700, color: '#2563eb', fontSize: '20px' }}>GET Delivery Partner Network</div>
      </header>
      <main style={{ flex: 1, padding: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        {children}
      </main>
    </div>
  );
}
