import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MotionEnhancements } from '@/components/MotionEnhancements';
import { ParticleAccent } from '@/components/ParticleAccent';
import { getProfile } from '@/lib/content';

export default async function PortfolioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await getProfile();
  return (
    <>
      <ParticleAccent variant="portfolio" />
      <a href="#main" className="skip-link">
        Skip to Content
      </a>
      <Header profile={{ name: profile.name }} />
      <MotionEnhancements />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <Footer profile={profile} />
    </>
  );
}
