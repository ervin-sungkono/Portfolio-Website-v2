export function monthLabel(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${value}-01T00:00:00Z`),
  );
}
