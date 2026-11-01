import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { ThemeProvider } from 'next-themes';
import '@/styles/globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { site } from '@/lib/metadata';
import { getPortfolio } from '@/lib/content';
import { MotionEnhancements } from '@/components/layout/MotionEnhancements';

const manrope = localFont({
  src: '../../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2',
  variable: '--font-manrope',
  weight: '200 800',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPortfolio().catch(() => null);
  if (!content) {
    return {
      metadataBase: new URL(site.url),
      title: 'Portfolio',
      icons: { icon: '/images/favicon-light.png' },
    };
  }
  const { profile } = content;
  const title = `${profile.name} | Frontend Software Engineer`;
  const description = `${profile.name}, software engineer at Samsung R&D Institute Indonesia. Explore React and Next.js projects, frontend case studies, and interface design.`;
  return {
    metadataBase: new URL(site.url),
    title: { default: title, template: `%s | ${profile.name}` },
    description,
    openGraph: { title, description, type: 'website', images: ['/images/preview-img.png'] },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/images/preview-img.png'],
    },
    icons: { icon: '/images/favicon-light.png' },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f9fb' },
    { media: '(prefers-color-scheme: dark)', color: '#141619' },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The owner can still reach CMS setup if the remote content is unavailable.
  const content = await getPortfolio().catch(() => null);
  return (
    <html lang="en" className={manrope.variable} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://raw.githubusercontent.com" />
        <link rel="preconnect" href="https://cdn.dribbble.com" />
      </head>
      <body>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="system"
          enableSystem
          enableColorScheme={false}
          storageKey="portfolio-theme"
        >
          <a href="#main" className="skip-link">
            Skip to Content
          </a>
          <Header name={content?.profile.name ?? 'Portfolio'} />
          <MotionEnhancements />
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          {content && <Footer />}
        </ThemeProvider>
      </body>
    </html>
  );
}
