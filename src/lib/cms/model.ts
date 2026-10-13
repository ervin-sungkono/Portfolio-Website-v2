import { z } from 'zod';
import projectData from '@/content/projects.json';
import designData from '@/content/designs.json';
import { profile, skills as staticSkills } from '@/content/profile';
import { CmsValidationError } from './errors';

export type CmsKind = 'project' | 'design' | 'profile';

const unsafeText = /[<>\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u;

function text(max: number, min = 1) {
  return z
    .string()
    .min(min, 'Enter a value.')
    .max(max, `Use ${max} characters or fewer.`)
    .refine((value) => value.trim().length >= min, 'Enter a value.')
    .refine(
      (value) => !unsafeText.test(value),
      'Use plain text without markup or control characters.',
    );
}

const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and single hyphens.');

const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, hyphens, or underscores.');

const httpsUrl = z
  .string()
  .min(1)
  .max(2048)
  .refine((value) => {
    if (value.trim() !== value || /[\u0000-\u0020\u007f]/u.test(value)) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'Use a valid HTTPS link.');

const mediaPath = z
  .string()
  .regex(
    /^\/media\/published\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[a-f0-9]{64}$/,
    'Use a published media URL.',
  );

const legacyImageUrls = new Set<string>([
  ...projectData.map((entry) => entry.image),
  ...designData.map((entry) => entry.image),
]);

const imageUrl = z
  .string()
  .min(1)
  .max(2048)
  .refine(
    (value) => legacyImageUrls.has(value) || mediaPath.safeParse(value).success,
    'Choose an existing portfolio image or a published CMS image.',
  );

const projectStudySchema = z.strictObject({
  focus: text(160),
  context: text(6000),
  challenge: text(6000),
  highlights: z.array(text(500)).max(24),
  decisions: z
    .array(
      z.strictObject({
        title: text(180),
        implementation: text(4000),
        tradeoff: text(4000),
      }),
    )
    .max(16),
  nextStep: text(3000),
  reference: z.strictObject({ label: text(180), href: httpsUrl }),
});

const projectSchema = z.strictObject({
  id: idSchema,
  slug: slugSchema,
  name: text(160),
  description: text(10000),
  image: imageUrl,
  topics: z.array(text(100)).max(40),
  category: text(80),
  source: httpsUrl,
  demo: httpsUrl.nullable(),
  study: projectStudySchema.optional(),
});

const designSchema = z.strictObject({
  title: text(240),
  url: httpsUrl,
  id: idSchema,
  image: imageUrl,
  category: z.string().refine((value): boolean => value === 'Web' || value === 'Mobile'),
});

const experienceSchema = z
  .strictObject({
    company: text(180),
    role: text(180),
    start: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    end: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .nullable(),
    description: text(4000),
  })
  .refine(
    ({ start, end }) => end === null || end >= start,
    'The end date must be on or after the start date.',
  );

const skillIcons = new Set(staticSkills.map((skill) => skill.icon));
const skillSchema = z.strictObject({
  label: text(100),
  icon: z.string().refine((value) => skillIcons.has(value), 'Choose an available skill icon.'),
});

const profileSchema = z.strictObject({
  name: z.literal(profile.name),
  title: text(160),
  linkedin: httpsUrl,
  github: httpsUrl,
  dribbble: httpsUrl,
  instagram: httpsUrl,
  cv: httpsUrl,
  intro: text(3000),
  experiences: z.array(experienceSchema).max(20),
  education: z.strictObject({
    school: text(180),
    degree: text(240),
    years: text(80),
  }),
  skills: z.array(skillSchema).max(40),
});

export type Skill = z.infer<typeof skillSchema>;
export type ProjectStudyPayload = z.infer<typeof projectStudySchema>;
export type ProjectPayload = z.infer<typeof projectSchema>;
export type DesignPayload = z.infer<typeof designSchema>;
export type ProfileExperience = z.infer<typeof experienceSchema>;
export type ProfilePayload = z.infer<typeof profileSchema>;
export type CmsPayload = ProjectPayload | DesignPayload | ProfilePayload;

const schemas = {
  project: projectSchema,
  design: designSchema,
  profile: profileSchema,
} satisfies Record<CmsKind, z.ZodType<CmsPayload>>;

function safeIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

export function isCmsKind(value: unknown): value is CmsKind {
  return value === 'project' || value === 'design' || value === 'profile';
}

export function validatePayload<K extends CmsKind>(kind: K, input: unknown): PayloadFor<K>;
export function validatePayload(kind: CmsKind, input: unknown): CmsPayload {
  const result = schemas[kind].safeParse(input);
  if (!result.success) {
    throw new CmsValidationError(
      'Check the content fields and try again.',
      safeIssues(result.error),
    );
  }
  return result.data;
}

export type PayloadFor<K extends CmsKind> = K extends 'project'
  ? ProjectPayload
  : K extends 'design'
    ? DesignPayload
    : ProfilePayload;

export function getEntryTitle(kind: CmsKind, payload: CmsPayload): string {
  switch (kind) {
    case 'project':
      return (payload as ProjectPayload).name;
    case 'design':
      return (payload as DesignPayload).title;
    case 'profile':
      return 'Profile';
  }
}

export function getPayloadMediaReferences(payload: CmsPayload): { id: string; version: string }[] {
  if (!('image' in payload) || !payload.image.startsWith('/media/published/')) return [];
  const match = /^\/media\/published\/([0-9a-f-]{36})\/([a-f0-9]{64})$/.exec(payload.image);
  if (!match) {
    throw new CmsValidationError('Choose a valid published CMS image.');
  }
  return [{ id: match[1], version: match[2] }];
}
