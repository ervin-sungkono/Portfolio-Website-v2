'use client';

import { useEffect, useState } from 'react';
import styles from './theme-toggle.module.css';

type Theme = 'light' | 'dark';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  function toggle() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
    try {
      localStorage.setItem('portfolio-theme', nextTheme);
    } catch {
      // The in-page theme still changes when storage is unavailable.
    }
  }

  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button className={styles.button} type="button" onClick={toggle} aria-label={label}>
      <span className={styles.icon} aria-hidden="true">
        {theme === 'dark' ? '☼' : '◐'}
      </span>
      <span className={styles.label}>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
    </button>
  );
}
