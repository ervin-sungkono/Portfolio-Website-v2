import 'server-only';

import { revalidatePath, revalidateTag } from 'next/cache';
import { contentInvalidation, type CacheTarget } from './cache-policy.ts';

export function invalidateContent(target: CacheTarget, slug?: string) {
  const { tags, paths } = contentInvalidation(target, slug);
  for (const tag of tags) {
    revalidateTag(tag, 'max');
  }
  for (const path of paths) {
    if (path.includes('[slug]')) {
      revalidatePath(path, 'page');
    } else {
      revalidatePath(path);
    }
  }
}
