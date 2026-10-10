import Link from 'next/link';
import { ArrowUpRightIcon, ArrowRightIcon } from '@phosphor-icons/react/dist/ssr';
import {
  portfolioDecisions,
  portfolioFileUrl,
  portfolioSource,
  portfolioSourceRef,
} from '@/lib/content';
import { ExternalLink } from '@/components/external-link';
import styles from '@/components/engineering.module.css';
import { Reveal } from '@/components/motion/reveal';
import { pageMetadata } from '@/lib/metadata';
import { profile } from '@/content/profile';

export const metadata = pageMetadata({
  title: 'Next.js Portfolio Architecture & Engineering',
  description: `Explore the Next.js and TypeScript architecture behind ${profile.name}’s portfolio: Server Components, accessible UI, contact validation, and engineering tradeoffs.`,
  path: '/engineering',
});

export default function EngineeringPage() {
  return (
    <div className="container">
      <section className={`page-heading ${styles.pageHeader}`}>
        <div className={styles.headerCopy}>
          <p className="eyebrow">02 / Engineering · A Working Example</p>
          <h1>Inside This Portfolio.</h1>
          <p>
            A small application with deliberate boundaries. Explore how the interface, content, and
            contact service fit together, and follow each decision into the source.
          </p>
        </div>
        <div className="hero-actions">
          <ExternalLink href={`${portfolioSource}/tree/${portfolioSourceRef}`} className="button">
            Explore Source <ArrowUpRightIcon size={18} aria-hidden="true" />
          </ExternalLink>
          <ExternalLink href={portfolioFileUrl('docs/architecture.md')} className="text-link">
            Architecture Notes <ArrowUpRightIcon size={17} aria-hidden="true" />
          </ExternalLink>
        </div>
      </section>
      <section className={styles.feature} aria-labelledby="boundaries-heading">
        <div className={styles.featureIntro}>
          <p className="eyebrow">Architecture</p>
          <h2 id="boundaries-heading">Small Pieces. Clear Responsibilities.</h2>
          <p>
            Next.js App Router and TypeScript provide the foundation. Shared UI uses focused
            components, native CSS, and common design tokens. Content renders on the server; small
            Client Components handle navigation, forms, and motion.
          </p>
        </div>
        <dl className={styles.boundaries}>
          <div>
            <dt>Pages & Content</dt>
            <dd>Route → shared content functions → project and profile records.</dd>
          </div>
          <div>
            <dt>Browser Interactions</dt>
            <dd>
              Navigation, themes, contact feedback, and motion stay in small Client Components.
            </dd>
          </div>
          <div>
            <dt>Email Delivery</dt>
            <dd>Form → route handler → validation and verification → server-only Gmail service.</dd>
          </div>
        </dl>
      </section>
      <section
        className={`section ${styles.decisionSection}`}
        id="decisions"
        aria-labelledby="decisions-heading"
      >
        <Reveal className={`section-heading ${styles.sectionHeading}`}>
          <h2 id="decisions-heading">Choices & Tradeoffs.</h2>
          <p>Each choice solves a current need and leaves a clear place for future changes.</p>
        </Reveal>
        <div className={styles.decisionGrid}>
          {portfolioDecisions.map((decision) => (
            <article key={decision.title} className={styles.decision}>
              <Reveal>
                <h3>{decision.title}</h3>
                <p>{decision.implementation}</p>
                <p>
                  <strong>Tradeoff.</strong> {decision.tradeoff}
                </p>
                <ExternalLink
                  href={portfolioFileUrl(decision.file)}
                  className={`text-link ${styles.sourceLink}`}
                >
                  <code translate="no">{decision.file}</code>
                  <ArrowUpRightIcon size={16} aria-hidden="true" />
                </ExternalLink>
              </Reveal>
            </article>
          ))}
        </div>
      </section>
      <section className={`section ${styles.checks}`} aria-labelledby="quality-heading">
        <div className={styles.checksIntro}>
          <p className="eyebrow">Quality in Practice</p>
          <h2 id="quality-heading">Check the Whole Experience.</h2>
          <p>
            Read the verification notes for the checks performed, their dates, and their limits.
            Source code is available alongside the interface.
          </p>
          <ExternalLink href={portfolioFileUrl('docs/verification.md')} className="text-link">
            Verification Notes <ArrowUpRightIcon size={17} aria-hidden="true" />
          </ExternalLink>
        </div>
        <div>
          <ul>
            <li>Strict TypeScript and a production build check the application together.</li>
            <li>
              Contact validation tests cover malformed input, limits, and email-header injection.
            </li>
            <li>
              Responsive layouts, keyboard navigation, and both themes are part of browser review.
            </li>
            <li>Automated accessibility checks complement visual and interaction review.</li>
          </ul>
          <p>
            Email delivery also needs an end-to-end check of provider configuration and receipt.
          </p>
          <Link href="/project" className="text-link">
            Explore Project Walkthroughs <ArrowRightIcon size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
