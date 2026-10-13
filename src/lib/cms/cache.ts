import 'server-only';
import { revalidatePath, revalidateTag } from 'next/cache';
import { completePublishEvent } from './store';

export async function refreshPublishedContent(
  eventId: string,
  slug?: string,
): Promise<{ refreshed: boolean }> {
  try {
    // Immediate expiry is required for unpublishing; stale-while-revalidate
    // could expose an old public version after its projection was removed.
    revalidateTag('cms:published', { expire: 0 });
    revalidatePath('/', 'layout');
    revalidatePath('/sitemap.xml');
    if (slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      revalidatePath(`/project/${slug}`);
    }
    await completePublishEvent(eventId);
    return { refreshed: true };
  } catch {
    // The database commit already succeeded. Preserve the outbox event for a
    // safe retry instead of reporting a rolled-back publication.
    return { refreshed: false };
  }
}
