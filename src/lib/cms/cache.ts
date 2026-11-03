import 'server-only';

import { revalidatePath, revalidateTag } from 'next/cache';
import { contentInvalidation, type CacheTarget } from './publishing.ts';

export function invalidateContent(target: CacheTarget, slug?: string) {
  const { tags, paths } = contentInvalidation(target, slug);
  invalidateCacheEntries(tags, paths);
}

export function invalidateContentBatch(changes: Array<{ target: CacheTarget; slug?: string }>) {
  const tags = new Set<string>();
  const paths = new Set<string>();
  for (const change of changes) {
    const invalidation = contentInvalidation(change.target, change.slug);
    invalidation.tags.forEach((tag) => tags.add(tag));
    invalidation.paths.forEach((path) => paths.add(path));
  }
  invalidateCacheEntries([...tags], [...paths]);
}

function invalidateCacheEntries(tags: string[], paths: string[]) {
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
