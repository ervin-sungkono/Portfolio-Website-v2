import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogBody } from '@/components/blog/BlogBody';
import { formatPublishedDate } from '@/components/blog/formatPublishedDate';
import { Button } from '@/components/common/Button';
import { findBlogPost, getPortfolio, getBlogPosts } from '@/lib/content';
import { pageMetadata } from '@/lib/metadata';
import styles from './style.module.css';

type Props = { params: Promise<{ slug: string }> };
const emptyBuildParam = '__empty-blog-build__';

export const instant = false;

export async function generateStaticParams() {
  const posts = await getBlogPosts();
  return posts.length ? posts.map(({ slug }) => ({ slug })) : [{ slug: emptyBuildParam }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (slug === emptyBuildParam) {
    return { title: 'Article Not Found', robots: { index: false, follow: false } };
  }

  const post = await findBlogPost(slug);
  if (!post) {
    return { title: 'Article Not Found', robots: { index: false, follow: false } };
  }

  const [{ profile }, metadata] = await Promise.all([
    getPortfolio(),
    pageMetadata({ title: post.title, description: post.summary, path: `/blog/${slug}` }),
  ]);

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

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  if (slug === emptyBuildParam) {
    notFound();
  }

  const post = await findBlogPost(slug);
  if (!post) {
    notFound();
  }
  const { profile } = await getPortfolio();

  return (
    <div className={`container ${styles.articlePage}`}>
      <Button kind="link" variant="text" className={styles.backLink} href="/blog" showArrow={false}>
        Back to Blog
      </Button>
      <article className={styles.article}>
        <header className={styles.articleHeader}>
          <p className={styles.articleMeta}>
            <time dateTime={post.publishedAt}>{formatPublishedDate(post.publishedAt)}</time>
            <span aria-hidden="true">·</span>
            <span>By {profile.name}</span>
          </p>
          <h1>{post.title}</h1>
          <p className={styles.summary}>{post.summary}</p>
        </header>
        <BlogBody body={post.body} />
      </article>
    </div>
  );
}
