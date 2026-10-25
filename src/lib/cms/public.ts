import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';
import { getSnapshot } from './repository.ts';
import type { Project } from '../content.ts';

function mediaUrl(owner: string, name: string, branch: string, path: string) {
  return `https://raw.githubusercontent.com/${[owner, name, branch, ...path.split('/')].map(encodeURIComponent).join('/')}`;
}

async function readPublicContent(adminId: string, repositoryName: string) {
  'use cache';
  // The source identifiers are explicit cache arguments; no cookies or OAuth tokens enter this scope.
  void adminId;
  void repositoryName;
  cacheTag('projects', 'site', 'taxonomy');
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 });
  const snapshot = await getSnapshot();
  const { owner, name, defaultBranch } = snapshot.repository;
  const projects: Project[] = snapshot.projects
    .filter(({ data }) => data.published)
    .sort((a, b) => a.data.sortOrder - b.data.sortOrder || a.slug.localeCompare(b.slug))
    .map(({ slug, data }) => ({
      id: slug,
      slug,
      name: data.title,
      description: data.summary,
      details: data.description,
      image: mediaUrl(owner, name, defaultBranch, data.media.cover),
      gallery: data.media.gallery.map((path) => mediaUrl(owner, name, defaultBranch, path)),
      topics: data.technologies.map((id) => snapshot.technologies.data[id].label),
      category: data.categories.map((id) => snapshot.categories.data[id].label).join(' / '),
      categories: data.categories.map((id) => snapshot.categories.data[id].label),
      tags: data.tags,
      source: data.links.source ?? null,
      demo: data.links.demo ?? null,
      featured: data.featured,
    }));
  return { projects, site: snapshot.site.data };
}

export async function getPublicContent() {
  const adminId = process.env.GITHUB_ADMIN_ID?.trim();
  const repositoryName = process.env.GITHUB_REPO?.trim();
  if (!adminId && !repositoryName) {
    return null;
  }
  // A configured source fails visibly on invalid configuration/content, never silently serves the old bundle.
  return readPublicContent(adminId ?? '', repositoryName ?? '');
}
