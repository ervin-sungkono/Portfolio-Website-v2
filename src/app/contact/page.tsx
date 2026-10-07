import type { Metadata } from 'next';
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { ContactForm } from '@/components/contact-form';
import { ExternalLink } from '@/components/external-link';
import { profile } from '@/content/profile';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with Ervin Sungkono about opportunities, projects, or collaborations.',
  alternates: { canonical: '/contact' },
};
export default function ContactPage() {
  return (
    <div className="container">
      <section className="page-heading">
        <h1>
          A Good Conversation
          <br />
          <span>Starts Here.</span>
        </h1>
        <p>For an opportunity, a collaboration, or a question about something I’ve built.</p>
      </section>
      <div className="contact-layout">
        <div className="contact-intro">
          <h2>Tell Me What You Have in Mind.</h2>
          <p>
            Share a little context about your team or project. You can also connect with me on
            LinkedIn.
          </p>
          <ExternalLink href={profile.linkedin} className="text-link">
            View LinkedIn <ArrowUpRightIcon size={17} aria-hidden="true" />
          </ExternalLink>
        </div>
        <ContactForm siteKey={process.env.NEXT_PUBLIC_RECAPTCHA_KEY} />
      </div>
    </div>
  );
}
