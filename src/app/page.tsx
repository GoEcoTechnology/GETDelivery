import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.container}>
      <div className={styles.hero}>
        <h1 className={styles.title}>GETDelivery</h1>
        <p className={styles.subtitle}>
          The unified platform for inventory management and delivery dispatching.
          Secure, fast, and built for multi-tenant logistics.
        </p>
      </div>

      <div className={styles.cardGrid} style={{ gridTemplateColumns: '1fr', maxWidth: '500px', margin: '0 auto' }}>
        <div className={`${styles.card} glass`}>
          <h2 className={styles.cardTitle}>Access Your Portal</h2>
          <p>Login to manage inventory, create deliveries, or administer the platform. Your role will determine your access automatically.</p>
          <Link href="/login" className="btn btn-primary" style={{ marginTop: 'auto' }}>
            Login to GETDelivery
          </Link>
        </div>
      </div>
    </main>
  );
}
