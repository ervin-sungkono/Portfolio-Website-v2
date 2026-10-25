'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ListIcon, XIcon } from '@phosphor-icons/react';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { profile } from '@/content/profile';
import lightLogo from '@public/images/favicon-light.png';
import darkLogo from '@public/images/favicon-dark.png';
import type { NavigationItem } from './type';
import './style.css';

const navigation: NavigationItem[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Projects', href: '/project' },
  { label: 'Engineering', href: '/engineering' },
  { label: 'Design', href: '/design' },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = header.current;
    if (!element) return;
    const measure = () => {
      document.documentElement.style.setProperty(
        '--measured-header-height',
        `${element.getBoundingClientRect().height}px`,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--measured-header-height');
    };
  }, []);

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

  return (
    <header
      ref={header}
      className="site-header"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="container site-header-inner">
        <Link
          className="site-header-brand"
          href="/"
          aria-label={`${profile.name}, home`}
          onClick={() => setOpen(false)}
        >
          <Image className="light-logo" src={lightLogo} alt="" width={48} height={48} unoptimized />
          <Image className="dark-logo" src={darkLogo} alt="" width={48} height={48} unoptimized />
          <span>
            {profile.name}
            <span className="site-header-brand-dot">.</span>
          </span>
        </Link>
        <div className="site-header-actions">
          <ThemeToggle />
          <button
            ref={menuButton}
            type="button"
            className="icon-button site-header-menu"
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
        <nav
          id="primary-navigation"
          aria-label="Primary"
          className={`site-header-nav ${open ? 'is-open' : ''}`}
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
            className="site-header-contact"
            onClick={() => setOpen(false)}
            aria-current={pathname === '/contact' ? 'page' : undefined}
          >
            Contact
          </Link>
        </nav>
      </div>
    </header>
  );
}
