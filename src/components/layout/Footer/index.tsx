import {
  GithubLogoIcon,
  LinkedinLogoIcon,
  DribbbleLogoIcon,
  InstagramLogoIcon,
} from '@phosphor-icons/react/dist/ssr';
import { getPortfolio } from '@/lib/content';
import { cacheLife } from 'next/cache';
import { Button } from '@/components/common/Button';
import type { FooterSocial } from './type';
import './style.css';

export async function Footer() {
  'use cache';
  cacheLife({ revalidate: Infinity, expire: Infinity });
  const { profile } = await getPortfolio();
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
          <h2>Have Something in Mind?</h2>
          <p>For opportunities, collaborations, or a conversation about the work.</p>
        </div>
        <Button kind="link" href="/contact" variant="outline">
          Contact
        </Button>
      </div>
      <div className="site-footer-bottom">
        <span>
          © {new Date().getUTCFullYear()} {profile.name}
        </span>
        <div className="site-footer-social-links">
          {socials.map(({ name, href, Icon }) => (
            <Button key={name} kind="external" href={href} aria-label={name} variant="icon">
              <Icon size={21} aria-hidden="true" />
            </Button>
          ))}
        </div>
        <Button kind="external" href={profile.cv} variant="text">
          View Resume
        </Button>
      </div>
    </footer>
  );
}
