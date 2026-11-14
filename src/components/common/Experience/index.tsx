import { getPortfolio } from '@/lib/content';
import { monthLabel } from '@/lib/dates';
import { Button } from '@/components/common/Button';
import { Reveal } from '../Reveal';
import { TimelineRail } from './TimelineRail';
import type { ExperienceProps } from './type';
import './style.css';

export async function Experience({ detailed = false }: ExperienceProps) {
  const { profile } = await getPortfolio();
  return (
    <section
      className="section experience-section"
      id="Experience"
      aria-labelledby="experience-heading"
    >
      <Reveal className="experience-section-intro">
        <h2 id="experience-heading">Experience That Shapes the Work.</h2>
        <p>From internal business applications to software engineering in R&D.</p>
        <Button kind="external" href={profile.linkedin} variant="text">
          View LinkedIn
        </Button>
      </Reveal>
      <div className="experience-section-timeline">
        <TimelineRail />
        {profile.experiences.map((item, index) => (
          <Reveal
            key={item.company}
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
      </div>
    </section>
  );
}
