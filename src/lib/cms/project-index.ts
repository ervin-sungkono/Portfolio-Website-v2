import 'server-only';

import { CmsError } from './errors.ts';
import { projectIndexSchema } from './schemas.ts';

export function serializeProjectIndex(projects: readonly string[]): string {
  const sortedProjects = [...projects].sort();
  const parsed = projectIndexSchema.safeParse({ schemaVersion: 1, projects: sortedProjects });
  if (!parsed.success) {
    throw new CmsError(
      'unsupported_repository',
      'The content repository has too many projects to build its public project index.',
      409,
    );
  }
  return `${JSON.stringify(parsed.data, null, 2)}\n`;
}

export function isProjectIndexCurrent(
  serialized: string | null,
  projects: readonly string[],
): boolean {
  if (serialized === null) {
    return false;
  }
  try {
    const previous = projectIndexSchema.safeParse(JSON.parse(serialized));
    const sortedProjects = [...projects].sort();
    return (
      previous.success && JSON.stringify(previous.data.projects) === JSON.stringify(sortedProjects)
    );
  } catch {
    return false;
  }
}
