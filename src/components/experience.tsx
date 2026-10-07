import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { profile } from '@/content/profile';
import { monthLabel } from '@/lib/dates';
import { ExternalLink } from './external-link';

export function Experience({ detailed = false }: { detailed?: boolean }) {
  return (
    <section className="experience section" id="experience">
      <div className="experience-intro">
        <h2>
          Experience That
          <br />
          Shapes the Work.
        </h2>
        <p>From internal business applications to software engineering in R&D.</p>
        <ExternalLink href={profile.linkedin} className="text-link">
          View LinkedIn <ArrowUpRightIcon size={17} aria-hidden="true" />
        </ExternalLink>
      </div>
      <div className="experience-list">
        {profile.experiences.map((item) => (
          <article key={item.company} className="experience-item">
            <p className="experience-date">
              <time dateTime={item.start}>{monthLabel(item.start)}</time> -{' '}
              {item.end ? <time dateTime={item.end}>{monthLabel(item.end)}</time> : 'Present'}
            </p>
            <h3>{item.role}</h3>
            <p className="experience-company">{item.company}</p>
            {detailed && <p className="experience-description">{item.description}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
