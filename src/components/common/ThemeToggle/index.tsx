'use client';

import { MoonIcon, SunIcon } from '@phosphor-icons/react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Theme } from './type';
import './style.css';

function syncThemeColor(theme: Theme) {
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.removeAttribute('media');
    meta.setAttribute('content', theme === 'dark' ? '#141619' : '#f8f9fb');
  });
}

export function ThemeToggle() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const currentTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    setTheme(currentTheme);
    syncThemeColor(currentTheme);
  }, [pathname]);

  function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
    syncThemeColor(nextTheme);
    try {
      localStorage.setItem('portfolio-theme', nextTheme);
    } catch {
      /* Theme still works without storage. */
    }
  }

  return (
    <button
      type="button"
      className="icon-button"
      aria-label={
        theme ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme` : 'Switch color theme'
      }
      onClick={toggleTheme}
    >
      <MoonIcon className="light-logo" size={20} aria-hidden="true" />
      <SunIcon className="dark-logo" size={20} aria-hidden="true" />
    </button>
  );
}
