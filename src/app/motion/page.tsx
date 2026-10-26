import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './motion.module.css';

export const metadata: Metadata = { title: 'Motion Studio' };

export default function MotionStudioPage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Motion Studio</h1>
      <div className={styles.notice} role="status">
        <strong>Recording is not available yet.</strong> Frameflow cannot record prototypes or export video
        today. Nothing on this page records your screen.
      </div>
      <section className={styles.section} aria-labelledby="planned">
        <h2 id="planned">What is planned</h2>
        <ol className={styles.steps}>
          <li>Paste a prototype link and see whether it is supported before you start.</li>
          <li>
            Start a recording yourself and walk through the journey. Recording is always clearly indicated.
          </li>
          <li>Review the take and retake it if needed.</li>
          <li>Frame it in the same device scenes as Mockup Studio, with restrained tap indicators.</li>
          <li>Render an MP4 in the background and download it once it has been checked.</li>
        </ol>
        <h2>Before this ships</h2>
        <p>
          Prototype compatibility, recording permissions, capture isolation and video encoding are being
          tested first. Only prototype types that pass those tests will be supported, so not every Figma
          prototype will work.
        </p>
        <p>
          In the meantime, <Link href="/mockup">Mockup Studio</Link> uses the same device scenes for still
          images.
        </p>
      </section>
      <button type="button" className={styles.disabled} disabled aria-describedby="record-unavailable">
        Start recording
      </button>
      <p id="record-unavailable" className="visually-hidden">
        Unavailable: recording has not been built yet.
      </p>
    </main>
  );
}
