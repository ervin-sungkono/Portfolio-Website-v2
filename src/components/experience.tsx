import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { profile } from '@/content/profile';
import { monthLabel } from '@/lib/dates';
import { ExternalLink } from './external-link';
import { Reveal } from './motion/reveal';
import styles from './experience.module.css';

export function Experience({ detailed = false }: { detailed?: boolean }) {
  return (
    <section
      className={`section ${styles.experience}`}
      id="experience"
      aria-labelledby="experience-heading"
    >
      <Reveal className={styles.intro}>
        <p className="eyebrow">03 / Experience</p>
        <h2 id="experience-heading">Experience That Shapes the Work.</h2>
        <p>From internal business applications to software engineering in R&D.</p>
        <ExternalLink href={profile.linkedin} className="text-link">
          View LinkedIn <ArrowUpRightIcon size={17} aria-hidden="true" />
        </ExternalLink>
      </Reveal>
      <div className={styles.timeline}>
        {profile.experiences.map((item, index) => (
          <Reveal key={item.company} className={styles.timelineEntry} delay={index * 0.06}>
            <article className={styles.entry}>
              <p className={styles.date}>
                <time dateTime={item.start}>{monthLabel(item.start)}</time> -{' '}
                {item.end ? <time dateTime={item.end}>{monthLabel(item.end)}</time> : 'Present'}
              </p>
              <h3>{item.role}</h3>
              <p className={styles.company}>{item.company}</p>
              {detailed && <p className={styles.description}>{item.description}</p>}
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
