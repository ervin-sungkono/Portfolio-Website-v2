'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ListIcon, XIcon, SunIcon, MoonIcon } from '@phosphor-icons/react';
import styles from './header.module.css';

const navigation = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Projects', href: '/project' },
  { label: 'Engineering', href: '/engineering' },
  { label: 'Design', href: '/design' },
];

function syncThemeColor(theme: string) {
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.removeAttribute('media');
    meta.setAttribute('content', theme === 'dark' ? '#141619' : '#f7f8fa');
  });
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    syncThemeColor(document.documentElement.dataset.theme || 'light');
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        menuButton.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function toggleTheme() {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    syncThemeColor(theme);
    try {
      localStorage.setItem('portfolio-theme', theme);
    } catch {
      /* Theme still works without storage. */
    }
  }

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link
          className={styles.brand}
          href="/"
          aria-label="Ervin Sungkono, home"
          onClick={() => setOpen(false)}
        >
          <Image
            className="light-logo"
            src="/images/navbar-logo.png"
            alt=""
            width={44}
            height={28}
          />
          <Image
            className="dark-logo"
            src="/images/navbar-logo-white.png"
            alt=""
            width={44}
            height={28}
          />
          <span>
            Ervin Sungkono<span className={styles.brandDot}>.</span>
          </span>
        </Link>
        <nav
          id="primary-navigation"
          aria-label="Primary"
          className={`${styles.nav} ${open ? styles.open : ''}`}
        >
          {navigation.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={
                pathname === href || (href !== '/' && pathname.startsWith(href + '/'))
                  ? 'page'
                  : undefined
              }
            >
              {label}
            </Link>
          ))}
          <Link
            href="/contact"
            className={styles.contact}
            onClick={() => setOpen(false)}
            aria-current={pathname === '/contact' ? 'page' : undefined}
          >
            Contact
          </Link>
        </nav>
        <div className={styles.actions}>
          <button
            type="button"
            className="icon-button"
            aria-label="Switch color theme"
            onClick={toggleTheme}
          >
            <MoonIcon className="light-logo" size={20} aria-hidden="true" />
            <SunIcon className="dark-logo" size={20} aria-hidden="true" />
          </button>
          <button
            ref={menuButton}
            type="button"
            className={`icon-button ${styles.menu}`}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-controls="primary-navigation"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? (
              <XIcon size={24} aria-hidden="true" />
            ) : (
              <ListIcon size={24} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
