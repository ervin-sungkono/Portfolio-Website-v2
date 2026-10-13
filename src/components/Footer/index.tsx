import Link from 'next/link';
import {
  ArrowUpRightIcon,
  GithubLogoIcon,
  LinkedinLogoIcon,
  DribbbleLogoIcon,
  InstagramLogoIcon,
} from '@phosphor-icons/react/dist/ssr';
import type { ProfilePayload } from '@/lib/cms/model';
import { ExternalLink } from '../ExternalLink';
import type { FooterSocial } from './type';
import './style.css';

export function Footer({ profile }: { profile: ProfilePayload }) {
  const socials: FooterSocial[] = [
    { name: 'GitHub', href: profile.github, Icon: GithubLogoIcon },
    { name: 'LinkedIn', href: profile.linkedin, Icon: LinkedinLogoIcon },
    { name: 'Dribbble', href: profile.dribbble, Icon: DribbbleLogoIcon },
    { name: 'Instagram', href: profile.instagram, Icon: InstagramLogoIcon },
  ];
  return (
    <footer className="site-footer container">
      <div className="site-footer-top">
        <div>
          <p className="eyebrow">05 / Contact</p>
          <h2>Have Something in Mind?</h2>
          <p>For opportunities, collaborations, or a conversation about the work.</p>
        </div>
        <Link href="/contact" className="button button-outline">
          Contact <ArrowUpRightIcon size={20} aria-hidden="true" />
        </Link>
      </div>
      <div className="site-footer-bottom">
        <span>
          © {new Date().getUTCFullYear()} {profile.name}
        </span>
        <div className="site-footer-social-links">
          {socials
            .filter(({ href }) => href)
            .map(({ name, href, Icon }) => (
              <ExternalLink key={name} href={href} aria-label={name} className="icon-button">
                <Icon size={21} aria-hidden="true" />
              </ExternalLink>
            ))}
        </div>
        {profile.cv && (
          <ExternalLink href={profile.cv} className="text-link">
            View Resume <ArrowUpRightIcon size={15} aria-hidden="true" />
          </ExternalLink>
        )}
      </div>
    </footer>
  );
}
