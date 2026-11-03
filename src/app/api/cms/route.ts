import { z } from 'zod';
import { requireOwner } from '@/lib/cms/auth';
import { CmsError } from '@/lib/cms/errors';
import { assertCmsOwner } from '@/lib/cms/github';
import { cmsErrorResponse, cmsResponse, readCmsJson, requireSameOrigin } from '@/lib/cms/http';
import { invalidateContent, invalidateContentBatch } from '@/lib/cms/cache';
import { publishAndRevalidate } from '@/lib/cms/publishing';
import { getSnapshot } from '@/lib/cms/repository';
import { initializeRepository } from '@/lib/cms/initialization';
import { finalizeCmsDraft } from '@/lib/cms/draft-finalization';
import { finalizeCmsDraftSchema } from '@/lib/cms/schemas';

const slug = z
  .string()
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const operationSchema = z.union([
  finalizeCmsDraftSchema,
  z.strictObject({ kind: z.literal('initialize') }),
  z
    .strictObject({
      kind: z.literal('revalidate'),
      target: z.enum(['project', 'site', 'taxonomy', 'designs', 'all']),
      slug: slug.optional(),
    })
    .refine(
      (data) => data.target !== 'project' || Boolean(data.slug),
      'Select the project to refresh.',
    ),
]);

export async function GET(request: Request) {
  try {
    const token = await requireOwner(request);
    return cmsResponse(await getSnapshot(token));
  } catch (error) {
    if (error instanceof CmsError && error.code === 'not_found') {
      return cmsResponse({ needsInitialization: true, error: error.message });
    }
    return cmsErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const token = await requireOwner(request);
    const parsed = operationSchema.safeParse(await readCmsJson(request, 4_400_000));
    if (!parsed.success) {
      return cmsResponse(
        { error: parsed.error.issues[0]?.message ?? 'Check the submitted content.' },
        400,
      );
    }
    const operation = parsed.data;
    if (operation.kind === 'finalize') {
      const invalidations = [
        ...[...operation.projects.upsert, ...operation.projects.delete].map(({ slug }) => ({
          target: 'project' as const,
          slug,
        })),
        ...(operation.site ? [{ target: 'site' as const }] : []),
        ...(operation.categories || operation.technologies
          ? [{ target: 'taxonomy' as const }]
          : []),
        ...(operation.designs ? [{ target: 'designs' as const }] : []),
      ];
      return cmsResponse(
        await publishAndRevalidate(
          () => finalizeCmsDraft(token, operation),
          () => invalidateContentBatch(invalidations),
        ),
      );
    }
    if (operation.kind === 'initialize') {
      return cmsResponse(
        await publishAndRevalidate(
          () => initializeRepository(token),
          () => invalidateContent('all'),
        ),
      );
    }
    if (operation.kind === 'revalidate') {
      await assertCmsOwner(token);
      invalidateContent(operation.target, operation.slug);
      return cmsResponse({ cache: 'refreshed' });
    }
    return cmsResponse({ error: 'Use final submit to publish CMS changes.' }, 405);
  } catch (error) {
    return cmsErrorResponse(error);
  }
}
