import styles from './admin.module.css';

export default function Loading() {
  return (
    <div style={{ padding: '24px', opacity: 0.5 }}>
       <div className={styles.header} style={{ marginBottom: '24px' }}>
        <div style={{ width: '200px', height: '32px', backgroundColor: '#e2e8f0', borderRadius: '8px', marginBottom: '8px' }} />
        <div style={{ width: '300px', height: '20px', backgroundColor: '#f1f5f9', borderRadius: '4px' }} />
      </div>
      <div className={styles.card} style={{ height: '400px', backgroundColor: '#f8fafc' }} />
    </div>
  );
}
