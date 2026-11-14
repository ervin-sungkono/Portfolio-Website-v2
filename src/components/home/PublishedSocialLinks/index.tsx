import { Button } from '@/components/common/Button';
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
        <Button key={label} kind="external" href={url} variant="text">
          {label}
        </Button>
      ))}
    </nav>
  );
}
