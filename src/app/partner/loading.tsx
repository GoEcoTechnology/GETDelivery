export default function PartnerLoading() {
  return (
    <div style={{ padding: '0' }}>
      {/* Header skeleton */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ width: '200px', height: '28px', borderRadius: '8px', background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
      </div>

      {/* Stats skeletons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ width: '60%', height: '13px', borderRadius: '6px', background: '#e2e8f0', marginBottom: '12px' }} />
            <div style={{ width: '40%', height: '28px', borderRadius: '6px', background: '#e2e8f0' }} />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1.5fr 1fr 1fr', gap: '16px', padding: '16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          {['100px','140px','180px','80px','100px'].map((w, i) => (
            <div key={i} style={{ height: '14px', width: w, borderRadius: '4px', background: '#cbd5e1' }} />
          ))}
        </div>
        {/* Table rows */}
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1.5fr 1fr 1fr', gap: '16px', padding: '18px 16px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
            {['60px','100px','200px','60px','80px'].map((w, j) => (
              <div key={j} style={{ height: '16px', width: w, borderRadius: '4px', background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
            ))}
          </div>
        ))}
      </div>

      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}
