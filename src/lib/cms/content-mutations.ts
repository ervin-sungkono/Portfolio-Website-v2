import 'server-only';

import { getDribbbleShots } from '../dribbble.ts';
import { CmsError, validationError } from './errors.ts';
import { assertCmsOwner } from './github.ts';
import { getOwnerRepository } from './github-repositories.ts';
import {
  deleteContentFile,
  getSnapshot,
  isValidProjectSlug,
  readPortfolio,
  type CmsSnapshot,
  validateReferences,
  writeContentFile,
} from './repository.ts';
import {
  categoriesSchema,
  portfolioSchema,
  publishMutationSchema,
  siteSchema,
  technologiesSchema,
  type PublishMutation,
} from './schemas.ts';

function conflict(message: string): CmsError {
  return new CmsError('conflict', message, 409);
}

export async function saveDesignSelection(
  token: string,
  expectedSha: string,
  designs: string[],
): Promise<{ commitUrl: string; sha: string; contentSha: string }> {
  await assertCmsOwner(token);
  const portfolio = await readPortfolio(token);
  if (portfolio.sha !== expectedSha) {
    throw conflict(
      'The portfolio changed after you opened it. Reload the CMS before saving again.',
    );
  }
  const available = new Set([
    ...portfolio.data.designs,
    ...(await getDribbbleShots()).map((shot) => shot.id),
  ]);
  if (designs.some((id) => !available.has(id))) {
    throw validationError('Select only shots from the connected Dribbble account.');
  }
  const data = portfolioSchema.parse({ ...portfolio.data, designs });
  return writeContentFile(
    portfolio.repository,
    'content/portfolio.json',
    `${JSON.stringify(data, null, 2)}\n`,
    expectedSha,
    'cms: publish design selection',
    token,
  );
}

function pathForMutation(mutation: PublishMutation): string {
  if (mutation.kind === 'project') {
    return `content/projects/${mutation.slug}.json`;
  }
  if (mutation.kind === 'site') {
    return 'content/site.json';
  }
  if (mutation.kind === 'categories') {
    return 'content/categories.json';
  }
  return 'content/technologies.json';
}

function checkSnapshotReferences(snapshot: CmsSnapshot, candidate: PublishMutation): Promise<void> {
  const categories = candidate.kind === 'categories' ? candidate.data : snapshot.categories.data;
  const technologies =
    candidate.kind === 'technologies' ? candidate.data : snapshot.technologies.data;
  const projects = snapshot.projects.map(({ slug, data }) => ({ slug, data }));
  if (candidate.kind === 'project') {
    const index = projects.findIndex(({ slug }) => slug === candidate.slug);
    const next = { slug: candidate.slug, data: candidate.data };
    if (index < 0) {
      projects.push(next);
    } else {
      projects[index] = next;
    }
  }
  return validateReferences(snapshot.repository, projects, categories, technologies, 'validation');
}

export async function publishContent(
  token: string,
  input: PublishMutation | unknown,
): Promise<{ commitUrl: string; sha: string; contentSha: string }> {
  await assertCmsOwner(token);
  const parsed = publishMutationSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const location = first?.path.length ? `${first.path.join('.')}: ` : '';
    throw validationError(`${location}${first?.message ?? 'Check the submitted content.'}`);
  }
  const mutation = parsed.data;
  const snapshot = await getSnapshot(token);
  const currentSha =
    mutation.kind === 'project'
      ? (snapshot.projects.find(({ slug }) => slug === mutation.slug)?.sha ?? null)
      : snapshot[mutation.kind].sha;
  if (currentSha !== mutation.expectedSha) {
    throw conflict('This content changed after you opened it. Reload the CMS before saving again.');
  }

  if (mutation.kind === 'project' && mutation.data.githubRepositoryId !== null) {
    const existing = snapshot.projects.find(({ slug }) => slug === mutation.slug);
    if (existing?.data.githubRepositoryId !== mutation.data.githubRepositoryId) {
      await getOwnerRepository(token, mutation.data.githubRepositoryId);
    }
  }

  if (mutation.kind !== 'site') {
    await checkSnapshotReferences(snapshot, mutation);
  }

  const path = pathForMutation(mutation);
  const data =
    mutation.kind === 'project'
      ? mutation.data
      : mutation.kind === 'site'
        ? siteSchema.parse(mutation.data)
        : mutation.kind === 'categories'
          ? categoriesSchema.parse(mutation.data)
          : technologiesSchema.parse(mutation.data);
  const label = mutation.kind === 'project' ? mutation.slug : mutation.kind;
  return writeContentFile(
    snapshot.repository,
    path,
    `${JSON.stringify(data, null, 2)}\n`,
    mutation.expectedSha,
    `cms: publish ${label}`,
    token,
  );
}

export async function deleteProject(
  token: string,
  slug: string,
  expectedSha: string,
): Promise<{ commitUrl: string; sha: string }> {
  await assertCmsOwner(token);
  if (!isValidProjectSlug(slug) || !/^[a-f0-9]{40}$/i.test(expectedSha)) {
    throw validationError('Provide a valid project slug and the version loaded by the CMS.');
  }
  const snapshot = await getSnapshot(token);
  const project = snapshot.projects.find((item) => item.slug === slug);
  if (!project || project.sha !== expectedSha) {
    throw conflict(
      'This project changed or was removed after you opened it. Reload the CMS before deleting it.',
    );
  }
  const remaining = snapshot.projects
    .filter(({ slug: projectSlug }) => projectSlug !== slug)
    .map(({ slug: projectSlug, data }) => ({ slug: projectSlug, data }));
  await validateReferences(
    snapshot.repository,
    remaining,
    snapshot.categories.data,
    snapshot.technologies.data,
  );
  return deleteContentFile(
    snapshot.repository,
    `content/projects/${slug}.json`,
    expectedSha,
    `cms: delete ${slug}`,
    token,
  );
}
