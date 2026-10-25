import { z } from 'zod';

const idSchema = z
  .string()
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const text = (max: number) => z.string().trim().min(1).max(max);
const imagePath = z
  .string()
  .regex(
    /^media\/projects\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:png|jpe?g|webp)$/i,
  );
const technologyIconPath = z
  .string()
  .regex(/^media\/technologies\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:png|jpe?g|webp|svg)$/i);

const httpsUrl = z
  .string()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'Use a valid HTTPS URL.');

const unique = <T extends string>(items: T[]) => new Set(items).size === items.length;

export const projectSchema = z.strictObject({
  schemaVersion: z.literal(1),
  title: text(120),
  summary: text(240),
  description: text(10_000),
  published: z.boolean(),
  featured: z.boolean(),
  sortOrder: z.number().int().min(0).max(100_000),
  year: z.number().int().min(1900).max(2200),
  categories: z.array(idSchema).min(1).max(20).refine(unique, 'Categories must be unique.'),
  technologies: z.array(idSchema).max(40).refine(unique, 'Technologies must be unique.'),
  tags: z
    .array(text(40))
    .max(30)
    .refine((items) => unique(items.map((item) => item.toLowerCase())), 'Tags must be unique.'),
  links: z.strictObject({ demo: httpsUrl.optional(), source: httpsUrl.optional() }),
  media: z.strictObject({
    cover: imagePath,
    gallery: z.array(imagePath).max(30).refine(unique, 'Gallery paths must be unique.'),
  }),
});

export const siteSchema = z.strictObject({
  schemaVersion: z.literal(1),
  siteTitle: text(120),
  headline: text(240),
  introduction: text(5_000),
  socialLinks: z
    .array(z.strictObject({ label: text(60), url: httpsUrl }))
    .max(20)
    .refine(
      (items) => unique(items.map(({ label }) => label.toLowerCase())),
      'Social link labels must be unique.',
    ),
});

export const categoriesSchema = z.record(
  idSchema,
  z.strictObject({ label: text(80), sortOrder: z.number().int().min(0).max(100_000) }),
);

export const technologiesSchema = z.record(
  idSchema,
  z.strictObject({ label: text(80), icon: technologyIconPath.optional() }),
);

const expectedSha = z
  .string()
  .regex(/^[a-f0-9]{40}$/i)
  .nullable();

export const publishMutationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('project'), slug: idSchema, expectedSha, data: projectSchema }),
  z.strictObject({ kind: z.literal('site'), expectedSha, data: siteSchema }),
  z.strictObject({ kind: z.literal('categories'), expectedSha, data: categoriesSchema }),
  z.strictObject({ kind: z.literal('technologies'), expectedSha, data: technologiesSchema }),
]);

export const uploadMediaSchema = z.strictObject({
  slug: z.union([z.literal('technologies'), idSchema]),
  filename: z.string().min(1).max(255),
  mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  content: z.string().min(1).max(1_398_104),
});

export type ProjectDocument = z.infer<typeof projectSchema>;
export type SiteDocument = z.infer<typeof siteSchema>;
export type Categories = z.infer<typeof categoriesSchema>;
export type Technologies = z.infer<typeof technologiesSchema>;
export type PublishMutation = z.infer<typeof publishMutationSchema>;
export type UploadMediaDocument = z.infer<typeof uploadMediaSchema>;
