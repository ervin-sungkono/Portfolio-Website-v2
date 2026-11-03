import { getPortfolio, getProjects, selectFeaturedProjects, filterProjects } from '@/lib/content';
import { ProjectIntro } from '@/components/project/ProjectIntro';
import { ProjectFilters } from '@/components/project/ProjectFilters';
import { ProjectCollection } from '@/components/project/ProjectCollection';
import { pageMetadata } from '@/lib/metadata';

export const instant = false;

export async function generateMetadata() {
  const { profile } = await getPortfolio();
  return pageMetadata({
    title: 'Software Engineering Projects',
    description: `Explore ${profile.name}’s React and Next.js projects, including WeTrack, a streaming chat interface, and an API-driven catalogue, with case studies and source code.`,
    path: '/project',
  });
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const [params, projects] = await Promise.all([searchParams, getProjects()]);
  const featuredProjects = selectFeaturedProjects(projects);
  const query = typeof params.q === 'string' ? params.q : '';
  const category = typeof params.category === 'string' ? params.category : '';
  const filtered = filterProjects(projects, query, category);
  const categoryLabels = projects.flatMap((project) => project.categories ?? [project.category]);
  const categories = [...new Set(categoryLabels)];
  const isUnfiltered = !query && !category;

  return (
    <div className="container">
      <ProjectIntro />
      <ProjectFilters
        query={query}
        category={category}
        categories={categories}
        count={filtered.length}
      />
      <ProjectCollection
        projects={projects}
        featuredProjects={featuredProjects}
        filtered={filtered}
        isUnfiltered={isUnfiltered}
      />
    </div>
  );
}
