import { getPortfolio } from '@/lib/content';
import { Button } from '@/components/common/Button';
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
      <Button kind="external" href={profile.dribbble} variant="text" className={styles.profileLink}>
        View Dribbble
      </Button>
    </section>
  );
}
