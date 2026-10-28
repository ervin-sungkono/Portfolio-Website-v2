import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/ssr';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { BlogBody } from '@/components/BlogBody';
import { formatPostDate } from '@/lib/format-date';
import { profile } from '@/content/profile';
import { findBlogPost } from '@/lib/content';
import { pageMetadata } from '@/lib/metadata';
import styles from './blog-post.module.css';

type Props = { params: Promise<{ slug: string }> };

export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await findBlogPost(slug);
  if (!post) {
    return { title: 'Article Not Found' };
  }

  const metadata = pageMetadata({
    title: post.title,
    description: post.summary,
    path: `/blog/${post.slug}`,
  });
  return {
    ...metadata,
    authors: [{ name: profile.name }],
    openGraph: {
      ...metadata.openGraph,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [profile.name],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  await connection();
  const post = await findBlogPost((await params).slug);
  if (!post) {
    notFound();
  }

  return (
    <div className={`container ${styles.blogPostPage}`}>
      <Link href="/blog" className={`text-link ${styles.backLink}`}>
        <ArrowLeftIcon size={17} aria-hidden="true" /> All Articles
      </Link>
      <article className={styles.post}>
        <header className={styles.postHeader}>
          <p className="editorial-label">
            Published <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time>
          </p>
          <h1>{post.title}</h1>
          <p className={styles.summary}>{post.summary}</p>
          <p className={styles.author}>By {profile.name}</p>
        </header>
        <BlogBody body={post.body} />
      </article>
    </div>
  );
}
