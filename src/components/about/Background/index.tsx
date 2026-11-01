import Image from 'next/image';
import { getPortfolio } from '@/lib/content';
import { ExternalLink } from '@/components/common/ExternalLink';
import bnccLogo from '@public/images/bncc-logo-default.png';
import faveLogo from '@public/images/fave-logo-default.png';
import styles from './style.module.css';

export async function Background() {
  const { profile } = await getPortfolio();
  return (
    <section className={`section ${styles.background}`}>
      <div className={styles.education}>
        <p className="eyebrow">Education</p>
        <h2>A Foundation in Computer Science.</h2>
        <p>
          {profile.education.degree}
          <br />
          {profile.education.school}, {profile.education.years}
        </p>
      </div>
      <div className={styles.backgroundStory}>
        <h3>Learning Through Collaboration</h3>
        <p>
          At Bina Nusantara Computer Club, I developed technical skills alongside teamwork, time
          management, and public speaking. As a FAVE Solution staff member, I worked with a team
          handling software projects.
        </p>
        <div className="organisation-links">
          <ExternalLink href="https://bncc.net">
            <Image
              src={bnccLogo}
              alt="Bina Nusantara Computer Club"
              width={180}
              height={90}
              sizes="8.25rem"
            />
          </ExternalLink>
          <ExternalLink href="https://favesolution.com">
            <Image src={faveLogo} alt="FAVE Solution" width={140} height={90} sizes="8.25rem" />
          </ExternalLink>
        </div>
      </div>
    </section>
  );
}
