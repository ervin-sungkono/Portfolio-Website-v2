import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { monthLabel } from '@/lib/dates';
import { ExternalLink } from '../ExternalLink';
import { Reveal } from '../Reveal';
import type { ExperienceProps } from './type';
import './style.css';

export function Experience({ profile, detailed = false }: ExperienceProps) {
  return (
    <section
      className="section experience-section"
      id="Experience"
      aria-labelledby="experience-heading"
    >
      <Reveal className="experience-section-intro">
        <p className="eyebrow">03 / Experience</p>
        <h2 id="experience-heading">Experience That Shapes the Work.</h2>
        <p>From internal business applications to software engineering in R&D.</p>
        {profile.linkedin && (
          <ExternalLink href={profile.linkedin} className="text-link">
            View LinkedIn <ArrowUpRightIcon size={17} aria-hidden="true" />
          </ExternalLink>
        )}
      </Reveal>
      <div className="experience-section-timeline">
        {profile.experiences.map((item, index) => (
          <Reveal
            key={`${item.company}-${item.start}-${index}`}
            className="experience-section-timeline-entry"
            delay={index * 0.06}
          >
            <article className="experience-section-entry">
              <p className="experience-section-date">
                <time dateTime={item.start}>{monthLabel(item.start)}</time> -{' '}
                {item.end ? <time dateTime={item.end}>{monthLabel(item.end)}</time> : 'Present'}
              </p>
              <h3>{item.role}</h3>
              <p className="experience-section-company">{item.company}</p>
              {detailed && <p className="experience-section-description">{item.description}</p>}
            </article>
          </Reveal>
        ))}
        {!profile.experiences.length && <p>No published experience details yet.</p>}
      </div>
    </section>
  );
}
