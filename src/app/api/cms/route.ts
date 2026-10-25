import { z } from 'zod';
import { requireOwner } from '@/lib/cms/auth';
import { CmsError } from '@/lib/cms/errors';
import { assertCmsOwner } from '@/lib/cms/github';
import { cmsErrorResponse, cmsResponse, readCmsJson, requireSameOrigin } from '@/lib/cms/http';
import { invalidateContent } from '@/lib/cms/cache';
import { publishAndRevalidate } from '@/lib/cms/publishing';
import { getSnapshot } from '@/lib/cms/repository';
import { deleteProject, initializeRepository, publishContent } from '@/lib/cms/service';
import { publishMutationSchema } from '@/lib/cms/schemas';

const slug = z
  .string()
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const operationSchema = z.union([
  publishMutationSchema,
  z.strictObject({ kind: z.literal('initialize') }),
  z.strictObject({
    kind: z.literal('delete-project'),
    slug,
    expectedSha: z.string().regex(/^[a-f0-9]{40}$/i),
  }),
  z
    .strictObject({
      kind: z.literal('revalidate'),
      target: z.enum(['project', 'site', 'taxonomy']),
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
    const parsed = operationSchema.safeParse(await readCmsJson(request));
    if (!parsed.success) {
      return cmsResponse(
        { error: parsed.error.issues[0]?.message ?? 'Check the submitted content.' },
        400,
      );
    }
    const operation = parsed.data;
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
    if (operation.kind === 'delete-project') {
      return cmsResponse(
        await publishAndRevalidate(
          () => deleteProject(token, operation.slug, operation.expectedSha),
          () => invalidateContent('project', operation.slug),
        ),
      );
    }
    const target =
      operation.kind === 'project' ? 'project' : operation.kind === 'site' ? 'site' : 'taxonomy';
    return cmsResponse(
      await publishAndRevalidate(
        async () => {
          const result = await publishContent(token, operation);
          return { ...result, commitSha: result.sha, sha: result.contentSha };
        },
        () => invalidateContent(target, operation.kind === 'project' ? operation.slug : undefined),
      ),
    );
  } catch (error) {
    return cmsErrorResponse(error);
  }
}
