import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import '@/styles/globals.css';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { profile } from '@/content/profile';

const origin = process.env.SITE_URL || 'https://ervin-sungkono.vercel.app';
const manrope = localFont({
  src: '../../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2',
  variable: '--font-manrope',
  weight: '200 800',
  display: 'swap',
});
export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: { default: 'Ervin Sungkono | Software Engineer', template: '%s | Ervin Sungkono' },
  description: profile.intro,
  openGraph: {
    title: 'Ervin Sungkono | Software Engineer',
    description: profile.intro,
    type: 'website',
    images: ['/images/preview-img.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ervin Sungkono | Software Engineer',
    description: profile.intro,
    images: ['/images/preview-img.png'],
  },
  icons: { icon: '/images/favicon-light.png' },
};
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8fa' },
    { media: '(prefers-color-scheme: dark)', color: '#141619' },
  ],
};

const themeScript = `try{var t=localStorage.getItem('portfolio-theme');document.documentElement.dataset.theme=t==='dark'||t==='light'?t:matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}catch{document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={manrope.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://raw.githubusercontent.com" />
        <link rel="preconnect" href="https://cdn.dribbble.com" />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to Content
        </a>
        <Header />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
