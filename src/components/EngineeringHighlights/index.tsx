import Link from 'next/link';
import { ArrowUpRightIcon, ArrowRightIcon } from '@phosphor-icons/react/dist/ssr';
import { engineeringCapabilities, findProject } from '@/lib/content';
import { Reveal } from '../common/Reveal';
import type { EngineeringCapability } from './type';
import './style.css';

const capabilities: readonly EngineeringCapability[] = engineeringCapabilities;

export function EngineeringHighlights() {
  return (
    <section className="section engineering-highlights" aria-labelledby="engineering-heading">
      <Reveal className="engineering-highlights-intro">
        <p className="eyebrow">02 / Engineering · Behind the Interface</p>
        <h2 id="engineering-heading">The Engineering in the Work.</h2>
        <p>Explore the workflows, integrations, and technical choices behind selected projects.</p>
        <Link href="/engineering" className="text-link">
          How This Site Is Built <ArrowRightIcon size={18} aria-hidden="true" />
        </Link>
      </Reveal>
      <div className="engineering-highlights-evidence-list">
        {capabilities.map((capability, index) => {
          const project = findProject(capability.projectSlug);
          if (!project) return null;
          return (
            <Reveal key={capability.projectSlug} className="engineering-highlights-evidence-reveal">
              <Link
                href={`/project/${project.slug}#engineering`}
                className="engineering-highlights-evidence-link"
              >
                <span className="engineering-highlights-evidence-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="engineering-highlights-evidence-copy">
                  <h3>{capability.title}</h3>
                  <p>{capability.description}</p>
                  <span className="engineering-highlights-project-label">
                    {project.name} · Read Walkthrough
                  </span>
                </div>
                <ArrowUpRightIcon size={22} aria-hidden="true" />
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
