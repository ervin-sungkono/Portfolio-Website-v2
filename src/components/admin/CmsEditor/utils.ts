export function safeCommitUrl(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}
