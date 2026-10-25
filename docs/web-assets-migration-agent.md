# LLM agent instructions: map legacy portfolio content

Use this prompt when asked to review or map the old `web-assets` content into the GitHub CMS format. The prior migration is already published; treat this as an audit or a newly requested mapping, not permission to rewrite the repository.

## Task

Map `ervin-sungkono/web-assets`'s old content from the `legacy` branch to the current CMS document schema. Inspect the current `master` branch first because it already contains the migrated content. Report the mapping and any differences or unresolved fields before proposing edits.

Read these sources before mapping:

- `src/lib/cms/schemas.ts` — authoritative, strict Zod schemas.
- `src/content/projects.json` and `src/content/profile.ts` — verified application facts and the numeric project ID-to-slug mapping.
- `docs/architecture.md#github-cms` — storage paths, publishing rules, and content ownership.
- `docs/verification.md#authorized-web-assets-publication` — published refs, retained asset paths, and rollback evidence.
- `web-assets/legacy` — the prior `data/`, `images/`, and `icons/` tree.
- `web-assets/master` — the already migrated CMS content and compatibility copies.

## Map into the current schema

The target repository stores:

- `content/site.json` using `siteSchema`.
- `content/categories.json` using `categoriesSchema`.
- `content/technologies.json` using `technologiesSchema`.
- One `content/projects/<slug>.json` per project using `projectSchema`.
- Project images under `media/projects/<slug>/`; optional technology icons under `media/technologies/`.

Use the schema definitions in `src/lib/cms/schemas.ts` as the source of truth. Project documents require `schemaVersion: 1`, `title`, `summary`, `description`, `published`, `featured`, `sortOrder`, `year`, category and technology ID arrays, `tags`, `links`, and `media` with a cover and gallery. Registries are keyed by stable lowercase-hyphen IDs. Do not add fields that strict schemas reject.

Map legacy files and fields as follows:

- Match `data/projects/<numeric-id>.json` to the existing slug through `src/content/projects.json`. Never guess a slug from a title or numeric ID.
- Map verified project names, descriptions, category, topics, demo/source links, and cover/gallery assets to their corresponding CMS fields. Use a literal, accurate excerpt for `summary` only when the source has no summary; flag derived text in the report.
- Map category and technology labels to stable registry IDs and update every project reference consistently. Put technologies in `technologies` when they describe the stack; keep other verified topics as tags. Do not invent categories, technologies, links, or project facts.
- Treat a missing legacy year as unresolved. A verified GitHub repository creation year may be proposed as a documented proxy, with its source and limitation stated; do not present it as a confirmed project completion year.
- Omit missing or null optional HTTPS links. Reject malformed, credential-bearing, or non-HTTPS URLs rather than copying them.
- Resolve each image to its actual legacy file and verify that its bytes match the intended project. Use supported raster formats and valid repository-relative `media/` paths. Keep gallery order when it is known. Technology icons are optional; retain the label and omit the icon when no valid, reviewed file exists.
- Keep the existing Frontend Mentor aggregate project and its verified challenge details together unless a later request explicitly authorizes separate project records.
- Preserve the existing `images/` and `icons/` compatibility files on `master` while the application still uses their URLs. Do not edit or delete the `legacy` branch.

## Report and safety

Return a concise mapping table with one row per legacy project: source file/ID, verified slug, proposed target file, asset mapping, evidence, and unresolved fields. Also report category/technology mappings, skipped or duplicate assets, and schema/reference errors. Compare the proposed result with the existing `master` documents and identify only real gaps; do not regenerate already-correct content.

Validate proposed documents against the shared Zod schemas and check that every project category, technology, cover, and gallery reference exists. Do not add a converter, migration utility, or other code to this repository. Do not initialize a repository over legacy data, push commits, change branches, delete files, or replace `master` without a separate explicit request. Keep the `legacy` ref and compatibility assets as rollback protection; if a later authorized change is published, prefer a reviewable commit that can be reverted over a branch reset.
