import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { ContactForm } from '@/components/contact-form';
import { ExternalLink } from '@/components/external-link';
import { profile } from '@/content/profile';
import { pageMetadata } from '@/lib/metadata';
import styles from './contact.module.css';

export const metadata = pageMetadata({
  title: 'Contact — Software Engineering Opportunities',
  description: `Contact ${profile.name} about software engineering opportunities, React and Next.js projects, frontend development, or interface design collaborations.`,
  path: '/contact',
});
export default function ContactPage() {
  return (
    <div className="container">
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
    </div>
  );
}
