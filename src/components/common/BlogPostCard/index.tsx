import Link from 'next/link';
import { formatPostDate } from '@/lib/format-date';
import type { BlogPostCardProps } from './type';
import './style.css';

export function BlogPostCard({ post }: BlogPostCardProps) {
  return (
    <article className="blog-post-card">
      <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time>
      <h2>
        <Link href={`/blog/${post.slug}`}>{post.title}</Link>
      </h2>
      <p>{post.summary}</p>
    </article>
  );
}
