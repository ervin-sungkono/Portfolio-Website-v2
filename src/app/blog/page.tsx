import type { Metadata } from 'next';
import { BlogPostCard } from '@/components/blog/BlogPostCard';
import { getBlogPosts, getPortfolio } from '@/lib/content';
import { pageMetadata } from '@/lib/metadata';
import styles from './style.module.css';

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await getPortfolio();
  return {
    ...(await pageMetadata({
      title: 'Blog',
      description: `Articles by ${profile.name}.`,
      path: '/blog',
    })),
    authors: [{ name: profile.name }],
  };
}

export default async function BlogPage() {
  const [{ profile }, posts] = await Promise.all([getPortfolio(), getBlogPosts()]);

  return (
    <div className={`container ${styles.blogPage}`}>
      <section className={`page-heading ${styles.intro}`}>
        <p className="eyebrow">Blog</p>
        <h1>Writing</h1>
        <p>Articles by {profile.name}.</p>
      </section>

      {posts.length ? (
        <section className={styles.archive} aria-labelledby="blog-archive-heading">
          <h2 id="blog-archive-heading" className="sr-only">
            Published articles
          </h2>
          <div className={styles.postGrid}>
            {posts.map((post) => (
              <BlogPostCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      ) : (
        <section className={styles.emptyState} aria-labelledby="blog-empty-heading">
          <h2 id="blog-empty-heading">No posts yet</h2>
          <p>Published articles will appear here.</p>
        </section>
      )}
    </div>
  );
}
