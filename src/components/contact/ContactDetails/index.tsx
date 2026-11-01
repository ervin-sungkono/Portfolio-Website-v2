import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { ContactForm } from '@/components/contact/ContactForm';
import { ExternalLink } from '@/components/common/ExternalLink';
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
        <ExternalLink href={profile.linkedin} className="text-link">
          View LinkedIn <ArrowUpRightIcon size={17} aria-hidden="true" />
        </ExternalLink>
      </div>
      <ContactForm siteKey={process.env.NEXT_PUBLIC_RECAPTCHA_KEY} />
    </section>
  );
}
