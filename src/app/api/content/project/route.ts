import { findProject } from '@/lib/content';
import { contentExistsResponse } from '@/lib/content-response';

// Proxy cannot use Cache Components. This server route shares the public catalog cache.
export async function GET(request: Request) {
  return contentExistsResponse(request, findProject);
}
