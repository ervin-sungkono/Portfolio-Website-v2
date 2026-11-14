import Link from 'next/link';
import { ArrowRightIcon, ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { ExternalLink } from '@/components/common/ExternalLink';
import type { ButtonProps, ButtonVariant } from './type';

function buttonClass(variant: ButtonVariant, className?: string) {
  const base =
    variant === 'outline'
      ? 'button button-outline'
      : variant === 'text'
        ? 'text-link'
        : variant === 'icon'
          ? 'icon-button'
          : 'button';
  return [base, className].filter(Boolean).join(' ');
}

export function Button(props: ButtonProps) {
  if (props.kind === 'action') {
    const {
      kind,
      variant = 'solid',
      className,
      children,
      showArrow,
      type = 'button',
      ...buttonProps
    } = props;
    void kind;
    void showArrow;
    return (
      <button className={buttonClass(variant, className)} type={type} {...buttonProps}>
        {children}
      </button>
    );
  }

  if (props.kind === 'link') {
    const { kind, variant = 'solid', className, children, showArrow, ...linkProps } = props;
    void kind;
    return (
      <Link className={buttonClass(variant, className)} {...linkProps}>
        {children}
        {variant !== 'icon' && showArrow !== false && (
          <ArrowRightIcon size={17} aria-hidden="true" />
        )}
      </Link>
    );
  }

  const { kind, variant = 'solid', className, children, showArrow, rel, ...anchorProps } = props;
  void kind;
  return (
    <ExternalLink className={buttonClass(variant, className)} rel={rel} {...anchorProps}>
      {children}
      {variant !== 'icon' && showArrow !== false && (
        <ArrowUpRightIcon size={17} aria-hidden="true" />
      )}
    </ExternalLink>
  );
}
