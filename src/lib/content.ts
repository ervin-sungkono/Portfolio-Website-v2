import projectData from '@/content/projects.json';
import designData from '@/content/designs.json';

export type Project = (typeof projectData)[number];
export type Design = (typeof designData)[number];

// One content boundary for pages. CMS implementation belongs in phase 2.
export const projects: readonly Project[] = projectData;
export const designs: readonly Design[] = designData;
export const featuredProjects = projects.slice(0, 3);

export function findProject(slug: string) {
  return projects.find((project) => project.slug === slug);
}

export function filterProjects(query: string, category: string) {
  const term = query.trim().toLowerCase();
  return projects.filter(
    (project) =>
      (!category || project.category === category) &&
      (!term ||
        `${project.name} ${project.description} ${project.topics.join(' ')}`
          .toLowerCase()
          .includes(term)),
  );
}

// Public content exports keep pages independent of the storage format.
export {
  projectStudies,
  engineeringCapabilities,
  portfolioDecisions,
  portfolioFileUrl,
  portfolioSource,
  portfolioSourceRef,
} from '@/content/engineering';

export function relatedProjects(project: Project, limit = 2) {
  // Shared technologies take priority, followed by projects in the same category.
  return projects
    .filter((candidate) => candidate.slug !== project.slug)
    .map((candidate) => ({
      project: candidate,
      score:
        candidate.topics.filter((topic) => project.topics.includes(topic)).length * 2 +
        Number(candidate.category === project.category),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ project: candidate }) => candidate);
}
