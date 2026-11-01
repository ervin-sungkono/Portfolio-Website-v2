import 'server-only';

import { getSnapshot, readContentFile, writeContentFile } from './repository.ts';
import { projectIndexSchema } from './schemas.ts';

// The public raw-content reader cannot list directories, so the CMS maintains this index.
export async function synchronizeProjectIndex(token: string) {
  const snapshot = await getSnapshot(token);
  const path = 'content/project-index.json';
  const existing = await readContentFile(snapshot.repository, path, token);
  const projects = snapshot.projects.map(({ slug }) => slug).sort();
  if (existing) {
    try {
      const previous = projectIndexSchema.safeParse(JSON.parse(existing.text));
      if (previous.success && JSON.stringify(previous.data.projects) === JSON.stringify(projects)) {
        return;
      }
    } catch {
      // Replace an invalid index after validating the repository's actual project documents.
    }
  }
  await writeContentFile(
    snapshot.repository,
    path,
    `${JSON.stringify({ schemaVersion: 1, projects }, null, 2)}\n`,
    existing?.sha ?? null,
    'cms: update public project index',
    token,
  );
}
