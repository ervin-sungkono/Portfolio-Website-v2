import { ContactForm } from '@/components/contact/ContactForm';
import { Button } from '@/components/common/Button';
import { getPortfolio } from '@/lib/content';
import styles from './style.module.css';

export async function ContactDetails() {
  const { profile } = await getPortfolio();
  return (
    <section className={styles.layout} aria-labelledby="contact-intro-heading">
      <div className={styles.intro}>
        <p className="eyebrow">Start a Conversation</p>
        <h2 id="contact-intro-heading">Tell Me What You Have in Mind.</h2>
        <p>
          Share a little context about your team or project. You can also connect with me on
          LinkedIn.
        </p>
        <Button kind="external" href={profile.linkedin} variant="text">
          View LinkedIn
        </Button>
      </div>
      <ContactForm siteKey={process.env.NEXT_PUBLIC_RECAPTCHA_KEY} />
    </section>
  );
}
