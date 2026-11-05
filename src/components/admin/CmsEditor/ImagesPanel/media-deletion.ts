import type { ProjectDocument, Technologies } from '@/lib/cms/schemas';
import type { CmsDraft } from '../../CmsDraftProvider/type';
import { applyDraft, stageProject } from '../draft';
import type { CmsSnapshot } from '../type';

function withoutImage(project: ProjectDocument, path: string): ProjectDocument {
  const gallery = project.media.gallery.filter((item) => item !== path);
  if (project.media.cover !== path) {
    return gallery.length === project.media.gallery.length
      ? project
      : { ...project, media: { ...project.media, gallery } };
  }
  const [cover, ...remaining] = gallery;
  if (!cover) {
    throw new Error(`Replace the cover of “${project.title}” before deleting this image.`);
  }
  return { ...project, media: { cover, gallery: remaining } };
}

export function stageMediaDeletion(
  draft: CmsDraft,
  snapshot: CmsSnapshot,
  image: { path: string; sha: string },
  current: {
    selectedSlug: string;
    newSlug: string;
    project: ProjectDocument;
    technologies: Technologies;
  },
) {
  const view = applyDraft(snapshot, draft);
  let next = draft;
  let selectedProject: ProjectDocument | undefined;
  const affected: string[] = [];

  for (const project of view.projects) {
    const data = project.slug === current.selectedSlug ? current.project : project.data;
    const changed = withoutImage(data, image.path);
    if (changed !== data) {
      next = stageProject(next, project.slug, project.sha || null, changed);
      affected.push(`Project: ${data.title}`);
      if (project.slug === current.selectedSlug) {
        selectedProject = changed;
      }
    }
  }

  const newProject =
    !current.selectedSlug && current.newSlug.trim()
      ? { slug: current.newSlug, data: current.project }
      : draft.newProject;
  if (newProject) {
    const changed = withoutImage(newProject.data, image.path);
    if (changed !== newProject.data) {
      next = { ...next, newProject: { slug: newProject.slug, data: changed } };
      if (!current.selectedSlug && current.newSlug.trim()) {
        selectedProject = changed;
      }
      affected.push(`New project: ${newProject.data.title || newProject.slug}`);
    }
  }

  let technologies = current.technologies;
  for (const [id, technology] of Object.entries(current.technologies)) {
    if (technology.icon === image.path) {
      if (technologies === current.technologies) {
        technologies = { ...current.technologies };
      }
      const withoutIcon = { ...technology };
      delete withoutIcon.icon;
      technologies[id] = withoutIcon;
      affected.push(`Technology: ${technology.label || id}`);
    }
  }
  if (technologies !== current.technologies) {
    next = {
      ...next,
      technologies: {
        expectedSha: next.technologies?.expectedSha ?? snapshot.technologies.sha,
        data: technologies,
      },
    };
  }
  next = {
    ...next,
    deleteMedia: [
      ...(next.deleteMedia ?? []).filter((item) => item.path !== image.path),
      { path: image.path, expectedSha: image.sha },
    ],
  };
  return { draft: next, selectedProject, technologies, affected };
}
