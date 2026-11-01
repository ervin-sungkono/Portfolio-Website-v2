import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import { ExternalLink } from '../ExternalLink';
import { Reveal } from '../Reveal';
import { PointerSurface } from './PointerSurface';
import { ParallaxImage } from '../ParallaxImage';
import { imageSizes } from '@/lib/image-sizes';
import type { ProjectCardProps } from './type';
import './style.css';

export function ProjectCard({
  project,
  featured = false,
  index,
  sizes = imageSizes.twoColumns,
  parallaxTravel,
}: ProjectCardProps) {
  const Surface = parallaxTravel === undefined ? PointerSurface : 'div';

  return (
    <article className={`project-card ${featured ? 'project-card-featured' : ''}`}>
      <Surface className="project-card-pointer-surface">
        <Link
          className="project-card-image-link"
          href={`/project/${project.slug}`}
          aria-label={`View ${project.name} project details`}
          data-cursor="project"
        >
          <div className="project-card-image-frame">
            <span className="project-card-frame-label" aria-hidden="true">
              PROJECT /{' '}
              {index === undefined
                ? project.category.toUpperCase()
                : String(index).padStart(2, '0')}
            </span>
            <ParallaxImage travel={parallaxTravel}>
              <Image
                src={project.image}
                alt={`${project.name} application screenshot`}
                width={1600}
                height={1000}
                sizes={sizes}
                className="project-card-image"
              />
            </ParallaxImage>
          </div>
        </Link>
      </Surface>
      <Reveal className="project-card-content">
        <div className="project-card-heading">
          <p className="editorial-label">{project.category}</p>
          <h3>{project.name}</h3>
        </div>
        <p className="project-card-description">{project.description}</p>
        <div className="tags">
          {project.topics.slice(0, 4).map((topic) => (
            <span key={topic}>{topic}</span>
          ))}
        </div>
        <div className="project-card-links">
          <Link href={`/project/${project.slug}`} className="text-link">
            {project.study ? 'Read Walkthrough' : 'Project Details'}
            <span className="sr-only"> for {project.name}</span>
            <ArrowUpRightIcon size={16} aria-hidden="true" />
          </Link>
          {project.source && (
            <ExternalLink href={project.source} className="text-link">
              Source <span className="sr-only"> for {project.name}</span>
              <ArrowUpRightIcon size={16} aria-hidden="true" />
            </ExternalLink>
          )}
        </div>
      </Reveal>
    </article>
  );
}
