import { requireOwner } from '@/lib/cms/auth';
import { cmsErrorResponse, cmsResponse, readCmsJson, requireSameOrigin } from '@/lib/cms/http';
import { uploadMedia } from '@/lib/cms/media';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const token = await requireOwner(request);
    // One MiB binary expands to base64; bound the stream before JSON parsing.
    const input = await readCmsJson(request, 1_450_000);
    return cmsResponse(await uploadMedia(token, input));
  } catch (error) {
    return cmsErrorResponse(error);
  }
}
