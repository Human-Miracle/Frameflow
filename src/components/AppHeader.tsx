'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './AppHeader.module.css';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/mockup', label: 'Mockup Studio' },
  { href: '/motion', label: 'Motion Studio' },
] as const;

export function AppHeader() {
  const pathname = usePathname();
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        Frameflow
      </Link>
      <nav aria-label="Primary" className={styles.nav}>
        <ul>
          {NAV_ITEMS.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`${styles.link} ${active ? styles.active : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
