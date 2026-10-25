// A cache error must never turn an accepted Git commit into a failed publication.
export async function publishAndRevalidate<T>(
  write: () => Promise<T>,
  invalidate: () => void | Promise<void>,
) {
  const result = await write();
  try {
    await invalidate();
    return { ...result, cache: 'refreshed' as const };
  } catch {
    return { ...result, cache: 'pending' as const };
  }
}
