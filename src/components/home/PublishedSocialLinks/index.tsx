import { ExternalLink } from '@/components/common/ExternalLink';
import type { getSiteContent } from '@/lib/content';

export function PublishedSocialLinks({
  links,
}: {
  links: Awaited<ReturnType<typeof getSiteContent>>['socialLinks'];
}) {
  if (links.length === 0) {
    return null;
  }
  return (
    <nav className="hero-actions" aria-label="Published social links">
      {links.map(({ label, url }) => (
        <ExternalLink key={label} href={url} className="text-link">
          {label}
        </ExternalLink>
      ))}
    </nav>
  );
}
