const dateFormatter = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
  year: 'numeric',
});

export function formatPostDate(publishedAt: string) {
  return dateFormatter.format(new Date(`${publishedAt}T00:00:00.000Z`));
}
