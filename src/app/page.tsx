import Link from 'next/link';
import styles from './home.module.css';

export default function HomePage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Present your product UI the way it deserves.</h1>
      <p className={styles.lead}>
        Frameflow places your real screenshots into device scenes and exports high-resolution images. Your
        screenshots stay in this browser; nothing is uploaded or redrawn.
      </p>
      <div className={styles.actions}>
        <Link href="/mockup" className={styles.card}>
          <span className={`${styles.status} ${styles.statusReady}`}>Available</span>
          <h2 className={styles.cardTitle}>Create mockup</h2>
          <p className={styles.cardBody}>
            Upload a PNG, JPEG or WebP screenshot, choose Minimal or Cinematic, and export a PNG up to 8K.
          </p>
        </Link>
        <Link href="/motion" className={styles.card}>
          <span className={styles.status}>In development</span>
          <h2 className={styles.cardTitle}>Create video</h2>
          <p className={styles.cardBody}>
            Guided prototype recording is not available yet. See what is planned and what works today.
          </p>
        </Link>
      </div>
    </main>
  );
}
