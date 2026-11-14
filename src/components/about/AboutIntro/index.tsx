import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { getPortfolio } from '@/lib/content';
import { Button } from '@/components/common/Button';
import { AboutArtwork } from './AboutArtwork';
import styles from './style.module.css';

export async function AboutIntro() {
  const { profile } = await getPortfolio();
  return (
    <section className={`page-heading ${styles.hero}`}>
      <div className={styles.heroCopy}>
        <p className="eyebrow">About {profile.name}</p>
        <h1>
          Engineering, With
          <br />
          an Eye for Design.
        </h1>
        <p className={styles.intro}>
          {profile.intro} I enjoy exploring how technology and good interface design can work
          together.
        </p>
        <Button kind="external" href={profile.cv} variant="outline" showArrow={false}>
          View Resume <ArrowUpRightIcon size={19} aria-hidden="true" />
        </Button>
      </div>
      <AboutArtwork />
    </section>
  );
}
