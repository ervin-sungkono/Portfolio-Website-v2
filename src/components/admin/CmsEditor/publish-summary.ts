import type { CmsDraft } from '../CmsDraftProvider/type';
import type { ProjectDocument } from '@/lib/cms/schemas';
import type { CmsSnapshot } from './type';

export type ChangeList = {
  added: string[];
  updated: string[];
  deleted: string[];
};

export type CmsPublishSummary = {
  projects: ChangeList;
  categories: ChangeList;
  technologies: ChangeList;
  siteFields: string[];
  designIds: string[] | null;
  imageFilenames: string[];
  mediaDeletions: string[];
};

function compareRecords<T extends { label: string }>(
  baseline: Record<string, T>,
  next: Record<string, T>,
): ChangeList {
  const before = new Set(Object.keys(baseline));
  const after = new Set(Object.keys(next));
  const ordered = (ids: string[]) => ids.sort((left, right) => left.localeCompare(right));
  const fieldLabels: Record<string, string> = { label: 'Label', sortOrder: 'Order', icon: 'Icon' };
  return {
    added: ordered(
      Object.keys(next)
        .filter((id) => !before.has(id))
        .map((id) => `${next[id].label} (${id})`),
    ),
    updated: ordered(
      Object.keys(next)
        .filter((id) => before.has(id) && JSON.stringify(baseline[id]) !== JSON.stringify(next[id]))
        .map((id) => {
          const previous = baseline[id];
          const updated = next[id];
          const label =
            previous.label === updated.label
              ? updated.label
              : `${previous.label} → ${updated.label}`;
          const fields = Object.keys({ ...previous, ...updated })
            .filter(
              (key) =>
                JSON.stringify(Reflect.get(previous, key)) !==
                JSON.stringify(Reflect.get(updated, key)),
            )
            .map((key) => fieldLabels[key] ?? key);
          return `${label} (${id}) — ${fields.join(', ')}`;
        }),
    ),
    deleted: ordered(
      Object.keys(baseline)
        .filter((id) => !after.has(id))
        .map((id) => `${baseline[id].label} (${id})`),
    ),
  };
}

function displayProject(slug: string, title?: string) {
  return `${title || slug} (${slug})`;
}

const projectFieldLabels: Record<keyof ProjectDocument, string> = {
  schemaVersion: 'Schema',
  githubRepositoryId: 'Repository',
  title: 'Title',
  summary: 'Summary',
  description: 'Description',
  published: 'Visibility',
  featured: 'Featured',
  sortOrder: 'Order',
  year: 'Year',
  categories: 'Categories',
  technologies: 'Technologies',
  tags: 'Tags',
  links: 'Links',
  media: 'Images',
};

export function summarizePublishDraft(baseline: CmsSnapshot, draft: CmsDraft): CmsPublishSummary {
  const baselineProjects = new Map(baseline.projects.map((project) => [project.slug, project]));
  const projects: ChangeList = {
    added: [],
    updated: [],
    deleted: [],
  };

  for (const project of draft.projects.upsert) {
    const current = baselineProjects.get(project.slug);
    if (!current) {
      projects.added.push(displayProject(project.slug, project.data.title));
    } else if (JSON.stringify(current.data) !== JSON.stringify(project.data)) {
      const fields = (Object.keys(projectFieldLabels) as Array<keyof ProjectDocument>)
        .filter((key) => JSON.stringify(current.data[key]) !== JSON.stringify(project.data[key]))
        .map((key) => projectFieldLabels[key]);
      projects.updated.push(
        `${displayProject(project.slug, project.data.title)} — ${fields.join(', ')}`,
      );
    }
  }

  for (const project of draft.projects.delete) {
    const current = baselineProjects.get(project.slug);
    projects.deleted.push(displayProject(project.slug, current?.data.title));
  }

  const siteFields = draft.site
    ? (
        [
          ['siteTitle', 'Site title'],
          ['headline', 'Headline'],
          ['introduction', 'Introduction'],
          ['heroProjectSlugs', 'Hero project selection'],
          ['socialLinks', 'Social links'],
        ] as const
      )
        .filter(
          ([key]) =>
            JSON.stringify(baseline.site.data[key]) !== JSON.stringify(draft.site?.data[key]),
        )
        .map(([, label]) => label)
    : [];

  return {
    projects: {
      added: projects.added.sort((left, right) => left.localeCompare(right)),
      updated: projects.updated.sort((left, right) => left.localeCompare(right)),
      deleted: projects.deleted.sort((left, right) => left.localeCompare(right)),
    },
    categories: compareRecords(
      baseline.categories.data,
      draft.categories?.data ?? baseline.categories.data,
    ),
    technologies: compareRecords(
      baseline.technologies.data,
      draft.technologies?.data ?? baseline.technologies.data,
    ),
    siteFields,
    designIds: draft.designs ? [...draft.designs.designs] : null,
    imageFilenames: draft.media.map((item) => item.filename),
    mediaDeletions: draft.deleteMedia?.map((item) => item.path) ?? [],
  };
}
