import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = {
  title: 'Ervin’s Adventure',
  description: 'A playful little world of personal stories, skills, and creations.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
