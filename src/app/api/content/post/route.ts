import { findBlogPost } from '@/lib/content';
import { contentExistsResponse } from '@/lib/content-response';

export async function GET(request: Request) {
  return contentExistsResponse(request, findBlogPost);
}
