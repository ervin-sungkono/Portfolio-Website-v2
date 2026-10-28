import { NotFoundContent } from '@/components/common/NotFoundContent';

export const metadata = { title: 'Post Not Found', robots: { index: false, follow: false } };

export default function BlogNotFoundPage() {
  return (
    <NotFoundContent
      description="Browse the published posts or return to the homepage."
      href="/blog"
      linkLabel="Read the Blog"
    />
  );
}
