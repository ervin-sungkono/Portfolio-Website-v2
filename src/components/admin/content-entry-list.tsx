import Link from 'next/link';
import type { CmsEntry, CmsKind } from '@/lib/cms/store';
import styles from './content-entry-list.module.css';

export function getEntryStatus(
  entry: Pick<CmsEntry, 'draftRevision' | 'publishedRevision' | 'archived'>,
) {
  if (entry.archived) return 'Archived';
  if (entry.publishedRevision === null) return 'Draft';
  if (entry.draftRevision > entry.publishedRevision) return 'Draft changes';
  return 'Published';
}

export function StatusBadge({ label }: { label: string }) {
  const className =
    label === 'Published'
      ? styles['status-published']
      : label === 'Draft changes'
        ? styles['status-changed']
        : label === 'Archived'
          ? styles['status-archived']
          : styles['status-draft'];

  return <span className={className}>{label}</span>;
}

export function ContentEntryList({
  entries,
  kind,
  emptyTitle,
  emptyDescription,
}: {
  entries: CmsEntry[];
  kind: CmsKind;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (entries.length === 0) {
    return (
      <section className={styles.empty}>
        <span className={styles['empty-index']} aria-hidden="true">
          00
        </span>
        <div>
          <h2>{emptyTitle}</h2>
          <p>{emptyDescription}</p>
        </div>
        <Link className={styles['primary-link']} href={`/admin/new/${kind}`}>
          Create the first draft
        </Link>
      </section>
    );
  }

  return (
    <div className={styles.list}>
      {entries.map((entry) => {
        const status = getEntryStatus(entry);
        return (
          <article className={styles.row} key={entry.id}>
            <div className={styles.position} aria-label={`Position ${entry.position + 1}`}>
              {String(entry.position + 1).padStart(2, '0')}
            </div>
            <div className={styles['entry-body']}>
              <div className={styles['entry-heading']}>
                <h2>
                  <Link href={`/admin/editor/${entry.id}`}>{entry.title}</Link>
                </h2>
                <StatusBadge label={status} />
              </div>
              <div className={styles.meta}>
                <span>{entry.slug}</span>
                <span>Draft revision {entry.draftRevision}</span>
                {entry.publishedRevision !== null ? (
                  <span>Published revision {entry.publishedRevision}</span>
                ) : null}
                <time dateTime={entry.updatedAt}>{formatDate(entry.updatedAt)}</time>
              </div>
            </div>
            <div className={styles['row-actions']}>
              {entry.archived ? null : (
                <Link className={styles['secondary-link']} href={`/admin/preview/${entry.id}`}>
                  Preview
                </Link>
              )}
              <Link className={styles['edit-link']} href={`/admin/editor/${entry.id}`}>
                Edit
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
