import { requireOwner } from '@/lib/cms/auth';
import { cmsErrorResponse, cmsResponse, readCmsJson, requireSameOrigin } from '@/lib/cms/http';
import { stageMediaBlob } from '@/lib/cms/media';
import { getGitBranchState } from '@/lib/cms/git-data';
import { listExistingMedia, resolveRepository } from '@/lib/cms/repository';

export async function GET(request: Request) {
  try {
    const token = await requireOwner(request);
    const repository = await resolveRepository(token);
    const branch = await getGitBranchState(repository, token);
    return cmsResponse({
      repository,
      media: await listExistingMedia(repository, token, branch.commitSha),
    });
  } catch (error) {
    return cmsErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const token = await requireOwner(request);
    // One MiB binary expands to base64; this endpoint stages a Git blob without moving the branch.
    const input = await readCmsJson(request, 1_450_000);
    return cmsResponse(await stageMediaBlob(token, input));
  } catch (error) {
    return cmsErrorResponse(error);
  }
}
