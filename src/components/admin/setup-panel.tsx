import styles from './setup-panel.module.css';

export function SetupPanel({
  missing,
  title = 'CMS setup is incomplete',
  message,
}: {
  missing: readonly string[];
  title?: string;
  message?: string;
}) {
  return (
    <section className={styles.panel} aria-labelledby="setup-title">
      <p className={styles.eyebrow}>Workspace unavailable</p>
      <h1 id="setup-title">{title}</h1>
      <p className={styles.copy}>
        {message ??
          'The private editor is unavailable until its server configuration is complete. Publishing and editing are disabled while setup is incomplete.'}
      </p>

      {missing.length > 0 ? (
        <div className={styles['missing-group']}>
          <h2>Configuration names to provide</h2>
          <ul>
            {missing.map((name) => (
              <li key={name}>
                <code>{name}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.waiting}>
          Configured values are present, but the service is not responding.
        </p>
      )}

      <p className={styles.note}>
        Add values through the deployment’s server environment and apply the CMS and auth
        migrations. Secret values are never shown here.
      </p>
    </section>
  );
}
