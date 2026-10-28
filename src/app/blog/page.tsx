import type { Metadata } from 'next';
import { BlogPostCard } from '@/components/common/BlogPostCard';
import { getBlogPosts } from '@/lib/content';
import { pageMetadata } from '@/lib/metadata';
import { profile } from '@/content/profile';
import styles from './blog.module.css';

export const instant = false;

export const metadata: Metadata = {
  ...pageMetadata({
    title: 'Blog',
    description: `Articles by ${profile.name}.`,
    path: '/blog',
  }),
  authors: [{ name: profile.name }],
};

export default async function BlogPage() {
  const posts = await getBlogPosts();

  return (
    <div className={`container ${styles.blogPage}`}>
      <section className={`page-heading ${styles.intro}`}>
        <p className="editorial-label">Blog</p>
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
