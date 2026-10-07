import type { ComponentProps } from 'react';

export function ExternalLink({ children, ...props }: ComponentProps<'a'>) {
  return (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
