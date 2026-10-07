import Link from 'next/link';
import {
  ArrowUpRightIcon,
  GithubLogoIcon,
  LinkedinLogoIcon,
  DribbbleLogoIcon,
  InstagramLogoIcon,
} from '@phosphor-icons/react/dist/ssr';
import { profile } from '@/content/profile';
import { ExternalLink } from './external-link';

export function Footer() {
  const socials = [
    { name: 'GitHub', href: profile.github, Icon: GithubLogoIcon },
    { name: 'LinkedIn', href: profile.linkedin, Icon: LinkedinLogoIcon },
    { name: 'Dribbble', href: profile.dribbble, Icon: DribbbleLogoIcon },
    { name: 'Instagram', href: profile.instagram, Icon: InstagramLogoIcon },
  ];
  return (
    <footer className="footer container">
      <div className="footer-top">
        <div>
          <h2>Have Something in Mind?</h2>
          <p>For opportunities, collaborations, or a conversation about the work.</p>
        </div>
        <Link href="/contact" className="button button-outline">
          Contact <ArrowUpRightIcon size={20} aria-hidden="true" />
        </Link>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getUTCFullYear()} {profile.shortName}
        </span>
        <div className="social-links">
          {socials.map(({ name, href, Icon }) => (
            <ExternalLink key={name} href={href} aria-label={name} className="icon-button">
              <Icon size={21} aria-hidden="true" />
            </ExternalLink>
          ))}
        </div>
        <ExternalLink href={profile.cv} className="text-link">
          View CV <ArrowUpRightIcon size={15} aria-hidden="true" />
        </ExternalLink>
      </div>
    </footer>
  );
}
