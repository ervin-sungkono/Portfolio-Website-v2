import { getPortfolio } from '@/lib/content';
import styles from './style.module.css';

export async function ContactIntro() {
  const { profile } = await getPortfolio();
  return (
    <section className={`page-heading ${styles.heading}`}>
      <div className={styles.headingCopy}>
        <p className="eyebrow">Contact {profile.name}</p>
        <h1>
          A Good Conversation
          <br />
          <span>Starts Here.</span>
        </h1>
        <p>For an opportunity, a collaboration, or a question about something I’ve built.</p>
      </div>
    </section>
  );
}
