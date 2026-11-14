import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '../Reveal';
import { PointerSurface } from '../PointerSurface';
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
      <Reveal className="project-card-reveal" delay={(Math.max(0, (index ?? 1) - 1) % 3) * 0.06}>
        <Surface className="project-card-pointer-surface">
          <Link
            className="project-card-link"
            href={`/project/${project.slug}`}
            data-cursor="project"
          >
            <div className="project-card-image-frame">
              <ParallaxImage travel={parallaxTravel}>
                <Image
                  src={project.image}
                  alt=""
                  width={1600}
                  height={1000}
                  sizes={sizes}
                  className="project-card-image"
                />
              </ParallaxImage>
            </div>
            <div className="project-card-content">
              <p className="project-card-category">
                {project.category} · {project.year}
              </p>
              <h3>{project.name}</h3>
              <p className="project-card-description">{project.description}</p>
            </div>
          </Link>
        </Surface>
      </Reveal>
    </article>
  );
}
