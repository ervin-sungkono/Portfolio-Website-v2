'use client';

import { MoonIcon, SunIcon } from '@phosphor-icons/react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useSyncExternalStore } from 'react';
import type { Theme } from './type';
import './style.css';

function subscribeToNothing() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

function syncThemeColor(theme: Theme) {
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.removeAttribute('media');
    meta.setAttribute('content', theme === 'dark' ? '#141619' : '#f8f9fb');
  });
}

export function ThemeToggle() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeToNothing, getClientSnapshot, getServerSnapshot);
  const theme: Theme | null =
    mounted && (resolvedTheme === 'dark' || resolvedTheme === 'light') ? resolvedTheme : null;

  useEffect(() => {
    if (resolvedTheme === 'dark' || resolvedTheme === 'light') {
      syncThemeColor(resolvedTheme);
    }
  }, [pathname, resolvedTheme]);

  function toggleTheme() {
    if (!theme) {
      return;
    }
    setTheme(theme === 'dark' ? 'light' : 'dark');
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
