import { requireOwner } from '@/lib/cms/auth';
import { cmsErrorResponse, cmsResponse } from '@/lib/cms/http';
import { listOwnerRepositories } from '@/lib/cms/github-repositories';

export async function GET(request: Request) {
  try {
    const token = await requireOwner(request);
    return cmsResponse({ repositories: await listOwnerRepositories(token) });
  } catch (error) {
    return cmsErrorResponse(error);
  }
}
