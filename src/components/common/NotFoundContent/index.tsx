import Link from 'next/link';
import type { NotFoundContentProps } from './type';
import './style.css';

export function NotFoundContent({
  description = 'Explore the projects or return to the homepage.',
  href = '/project',
  linkLabel = 'Explore Projects',
}: NotFoundContentProps) {
  return (
    <section className="not-found-content" data-not-found aria-labelledby="not-found-heading">
      <div className="not-found-content-copy">
        <p className="not-found-content-code" aria-hidden="true">
          404
        </p>
        <p className="eyebrow">404 / Page Not Found</p>
        <h1 id="not-found-heading">This Page Isn’t Here.</h1>
        <p className="not-found-content-description">{description}</p>
        <div className="not-found-content-actions">
          <Link href="/" className="button">
            Back to Home
          </Link>
          <Link href={href} className="text-link">
            {linkLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
