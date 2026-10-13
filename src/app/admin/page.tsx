import Link from 'next/link';
import type { Metadata } from 'next';
import { AdminCentered, AdminFrame } from '@/components/admin/admin-frame';
import { AdminStatusPanel } from '@/components/admin/admin-status-panel';
import { SetupPanel } from '@/components/admin/setup-panel';
import { getPendingPublishEvents, listAuditEvents, listEntries } from '@/lib/cms/store';
import { getOwnerPageAccess, getPublicSourceMode, isSetupState } from './page-helpers';
import { RetryPublicationControl } from '@/components/admin/retry-publication-control';
import styles from './dashboard.module.css';

export const metadata: Metadata = { title: 'Overview · Portfolio CMS' };

function formatAction(action: string) {
  return (
    {
      created: 'Created a draft',
      saved: 'Saved a draft',
      published: 'Published content',
      unpublished: 'Unpublished content',
      restored: 'Restored a revision',
      seeded: 'Imported content',
    }[action] ?? 'Updated content'
  );
}

export default async function AdminDashboardPage() {
  const access = await getOwnerPageAccess();
  if (isSetupState(access)) {
    return (
      <AdminCentered>
        <SetupPanel missing={access.missing} message={access.message} />
      </AdminCentered>
    );
  }

  try {
    const [entries, audit, pending] = await Promise.all([
      listEntries(),
      listAuditEvents(12),
      getPendingPublishEvents(),
    ]);
    const counts = {
      project: entries.filter((entry) => entry.kind === 'project').length,
      design: entries.filter((entry) => entry.kind === 'design').length,
      profile: entries.filter((entry) => entry.kind === 'profile').length,
      drafts: entries.filter(
        (entry) =>
          !entry.archived &&
          (entry.publishedRevision === null ||
            entry.draftRevision > (entry.publishedRevision ?? 0)),
      ).length,
    };
    const entryTitles = new Map(entries.map((entry) => [entry.id, entry.title]));

    return (
      <AdminFrame
        active="dashboard"
        email={access.session.email}
        sourceMode={getPublicSourceMode()}
        eyebrow="Editorial workspace"
        title="Good work starts here."
        description="A clear view of the portfolio’s drafts, published work, and recent changes."
        actions={
          <Link className={styles['new-button']} href="/admin/new/project">
            New project
          </Link>
        }
      >
        <section className={styles.metrics} aria-label="Content totals">
          <article className={styles['metric-card']}>
            <span>Projects</span>
            <strong>{counts.project}</strong>
            <Link href="/admin/content/project">
              Manage projects <span aria-hidden="true">↗</span>
            </Link>
          </article>
          <article className={styles['metric-card']}>
            <span>Design pieces</span>
            <strong>{counts.design}</strong>
            <Link href="/admin/content/design">
              Manage design work <span aria-hidden="true">↗</span>
            </Link>
          </article>
          <article className={styles['metric-card']}>
            <span>Profile</span>
            <strong>{counts.profile ? '01' : '—'}</strong>
            <Link href="/admin/content/profile">
              Manage profile <span aria-hidden="true">↗</span>
            </Link>
          </article>
          <article className={styles['metric-card']}>
            <span>Draft attention</span>
            <strong>{counts.drafts}</strong>
            <span className={styles['metric-note']}>Entries awaiting publication</span>
          </article>
        </section>

        {pending.length ? (
          <section className={styles['pending-card']} aria-labelledby="pending-title">
            <div>
              <p className={styles.eyebrow}>Publication status</p>
              <h2 id="pending-title">Public cache refresh is pending.</h2>
              <p>
                The database change is saved. Retry the cache invalidation so visitors see the
                latest published content.
              </p>
            </div>
            <RetryPublicationControl pendingCount={pending.length} />
          </section>
        ) : null}

        <div className={styles['dashboard-grid']}>
          <section className={styles.activity} aria-labelledby="activity-title">
            <div className={styles['section-heading']}>
              <div>
                <p className={styles.eyebrow}>Editorial record</p>
                <h2 id="activity-title">Recent activity</h2>
              </div>
              <span>{audit.length} latest</span>
            </div>
            {audit.length ? (
              <ol className={styles['activity-list']}>
                {audit.map((event) => (
                  <li key={event.id}>
                    <span className={styles['activity-mark']} aria-hidden="true" />
                    <div>
                      <strong>{formatAction(event.action)}</strong>
                      <p>
                        {event.entryId
                          ? (entryTitles.get(event.entryId) ?? 'Portfolio entry')
                          : 'Workspace'}
                      </p>
                    </div>
                    <time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time>
                  </li>
                ))}
              </ol>
            ) : (
              <div className={styles['activity-empty']}>
                <p>No changes have been recorded yet.</p>
                <span>Save a draft to begin the editorial history.</span>
              </div>
            )}
          </section>

          <aside className={styles['quick-actions']} aria-labelledby="quick-title">
            <p className={styles.eyebrow}>Workspace</p>
            <h2 id="quick-title">Quick access</h2>
            <Link href="/admin/content/project">
              <span>01</span>Project library <b aria-hidden="true">↗</b>
            </Link>
            <Link href="/admin/content/design">
              <span>02</span>Design archive <b aria-hidden="true">↗</b>
            </Link>
            <Link href="/admin/content/profile">
              <span>03</span>Profile & experience <b aria-hidden="true">↗</b>
            </Link>
            <Link href="/admin/media">
              <span>04</span>Media library <b aria-hidden="true">↗</b>
            </Link>
          </aside>
        </div>
      </AdminFrame>
    );
  } catch {
    return (
      <AdminFrame
        active="dashboard"
        email={access.session.email}
        sourceMode={getPublicSourceMode()}
        eyebrow="Editorial workspace"
        title="Workspace data is unavailable."
      >
        <AdminStatusPanel
          title="The content store could not be read."
          description="The CMS will not load checked-in content as a fallback. Check the database setup, then reload this page."
          href="/admin"
          linkLabel="Reload workspace"
        />
      </AdminFrame>
    );
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
