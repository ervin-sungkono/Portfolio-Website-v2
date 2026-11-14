import type { ChangeList, CmsPublishSummary } from './publish-summary';

function ChangeSection({ title, changes }: { title: string; changes: ChangeList }) {
  const entries = [
    ...changes.added.map((item) => `Add: ${item}`),
    ...changes.updated.map((item) => `Update: ${item}`),
    ...changes.deleted.map((item) => `Delete: ${item}`),
  ];
  if (!entries.length) {
    return null;
  }
  return (
    <section>
      <h3 className="cms-confirm-review-section-title">{title}</h3>
      <ul>
        {entries.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function PublishSummary({ summary }: { summary: CmsPublishSummary }) {
  const hasChanges =
    Object.values(summary.projects).some((items) => items.length) ||
    Object.values(summary.posts).some((items) => items.length) ||
    Object.values(summary.categories).some((items) => items.length) ||
    Object.values(summary.technologies).some((items) => items.length) ||
    summary.siteFields.length > 0 ||
    summary.designIds !== null ||
    summary.imageFilenames.length > 0 ||
    summary.mediaDeletions.length > 0;

  return (
    <div className="cms-confirm-review">
      <h3 className="cms-confirm-review-title">Changes to publish</h3>
      {hasChanges ? (
        <>
          <ChangeSection title="Projects" changes={summary.projects} />
          <ChangeSection title="Blog posts" changes={summary.posts} />
          <ChangeSection title="Categories" changes={summary.categories} />
          <ChangeSection title="Technologies" changes={summary.technologies} />
          {summary.siteFields.length > 0 && (
            <section>
              <h3>Site profile fields</h3>
              <ul>
                {summary.siteFields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            </section>
          )}
          {summary.designIds !== null && (
            <section>
              <h3>Selected design IDs</h3>
              {summary.designIds.length ? (
                <ul>
                  {summary.designIds.map((id) => (
                    <li key={id}>{id}</li>
                  ))}
                </ul>
              ) : (
                <p>No designs selected.</p>
              )}
            </section>
          )}
          {summary.imageFilenames.length > 0 && (
            <section>
              <h3>Staged images</h3>
              <ul>
                {summary.imageFilenames.map((filename) => (
                  <li key={filename}>{filename}</li>
                ))}
              </ul>
            </section>
          )}
          {summary.mediaDeletions.length > 0 && (
            <section>
              <h3>Committed images to delete</h3>
              <ul>
                {summary.mediaDeletions.map((path) => (
                  <li key={path}>{path}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <p>The prepared draft contains no content changes.</p>
      )}
    </div>
  );
}
