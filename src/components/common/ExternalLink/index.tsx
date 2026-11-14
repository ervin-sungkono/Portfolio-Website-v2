import type { ExternalLinkProps } from './type';

export function ExternalLink({ children, rel, ...props }: ExternalLinkProps) {
  return (
    <a {...props} target="_blank" rel={`${rel ?? ''} noopener noreferrer`.trim()}>
      {children}
    </a>
  );
}
