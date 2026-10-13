import type { Metadata } from 'next';
import { connection } from 'next/server';
import NotFoundContent from '@/components/not-found-content';

export const metadata: Metadata = {
  title: 'Project Not Found',
  robots: { index: false, follow: true },
};

// The project existence guard rewrites here with HTTP 404. Render a complete
// document without throwing into Next's streamed recovery path. Request-time
// rendering also prevents the generated static 404's long CDN cache lifetime
// from keeping a newly published slug unavailable.
export default async function ProjectNotFoundPage() {
  await connection();
  return (
    <main id="main" tabIndex={-1}>
      <NotFoundContent />
    </main>
  );
}
