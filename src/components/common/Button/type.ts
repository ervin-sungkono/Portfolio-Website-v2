import type { AnchorHTMLAttributes, ComponentProps, ReactNode } from 'react';
import Link from 'next/link';

export type ButtonVariant = 'solid' | 'outline' | 'text' | 'icon';

type SharedProps = {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
};

export type ActionButtonProps = SharedProps &
  Omit<ComponentProps<'button'>, 'children' | 'className'> & {
    kind: 'action';
    showArrow?: never;
  };

export type InternalButtonLinkProps = SharedProps &
  Omit<ComponentProps<typeof Link>, 'children' | 'className'> & {
    kind: 'link';
    showArrow?: boolean;
  };

export type ExternalButtonLinkProps = SharedProps &
  Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'children' | 'className' | 'href' | 'rel' | 'target'
  > & {
    kind: 'external';
    href: string;
    rel?: string;
    showArrow?: boolean;
  };

export type ButtonProps = ActionButtonProps | InternalButtonLinkProps | ExternalButtonLinkProps;
