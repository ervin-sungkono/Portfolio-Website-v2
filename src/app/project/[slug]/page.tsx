import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProjects, findProject, relatedProjects } from '@/lib/content';
import { ProjectHeader } from '@/components/project/ProjectHeader';
import { ProjectMedia } from '@/components/project/ProjectMedia';
import { ProjectStory } from '@/components/project/ProjectStory';
import { RelatedProjects } from '@/components/project/RelatedProjects';
import { pageMetadata } from '@/lib/metadata';
import styles from './style.module.css';

type Props = { params: Promise<{ slug: string }> };

export const instant = false;

export async function generateStaticParams() {
  return (await getProjects()).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await findProject(slug);
  if (!project) {
    return { title: 'Project Not Found' };
  }
  return pageMetadata({
    title: project.name,
    description: project.description,
    path: `/project/${slug}`,
    image: project.image,
    imageAlt: `${project.name} application interface`,
  });
}

export default async function ProjectPage({ params }: Props) {
  const project = await findProject((await params).slug);
  if (!project) {
    notFound();
  }
  const study = project.study;
  const related = relatedProjects(await getProjects(), project);

  return (
    <div className={`container ${styles.projectPage}`}>
      <ProjectHeader project={project} study={study} />
      <ProjectMedia project={project} />
      <ProjectStory project={project} study={study} />
      <RelatedProjects related={related} />
    </div>
  );
}
