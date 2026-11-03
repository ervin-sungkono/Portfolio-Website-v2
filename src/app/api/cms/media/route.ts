import { requireOwner } from '@/lib/cms/auth';
import { cmsErrorResponse, cmsResponse, readCmsJson, requireSameOrigin } from '@/lib/cms/http';
import { stageMediaBlob } from '@/lib/cms/media';

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
