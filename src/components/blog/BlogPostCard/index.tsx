import { Button } from '@/components/common/Button';
import { formatPublishedDate } from '@/lib/dates';
import type { BlogPostCardProps } from './type';
import './style.css';

export function BlogPostCard({ post }: BlogPostCardProps) {
  return (
    <article className="blog-post-card">
      <p className="blog-post-card-date">
        <time dateTime={post.publishedAt}>{formatPublishedDate(post.publishedAt)}</time>
      </p>
      <h2 className="blog-post-card-title">
        <Button kind="link" variant="text" href={`/blog/${post.slug}`}>
          {post.title}
        </Button>
      </h2>
      <p className="blog-post-card-summary">{post.summary}</p>
    </article>
  );
}
