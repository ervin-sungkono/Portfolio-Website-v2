import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { getPortfolio } from '@/lib/content';
import { ExternalLink } from '@/components/common/ExternalLink';
import styles from './style.module.css';

export async function DesignIntro() {
  const { profile } = await getPortfolio();
  return (
    <section className={`page-heading ${styles.designIntro}`}>
      <p className="editorial-label">Portfolio / Design</p>
      <h1>
        Interfaces With
        <br />
        <span>Thought Behind Them.</span>
      </h1>
      <p>
        Visual explorations for websites and mobile applications, from layout and hierarchy to the
        smaller details.
      </p>
      <ExternalLink href={profile.dribbble} className={`text-link ${styles.profileLink}`}>
        View Dribbble <ArrowUpRightIcon size={17} aria-hidden="true" />
      </ExternalLink>
    </section>
  );
}
