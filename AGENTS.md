# Project agent guide

Read [README](README.md) for setup and [architecture](docs/architecture.md) before changing application boundaries or publishing flows. Use [responsive and motion guidance](docs/responsive-and-motion.md) for UI changes and [verification](docs/verification.md) for command coverage and dated evidence. Keep each topic in its owning document; update guidance when implementation changes and distinguish fresh checks from historical results.

## Project conventions

- Use Node.js 24, npm, and the committed lockfile (`npm ci`). The package engine permits Node 22+, but the CMS browser fixture requires 24.
- `src/app` owns App Router pages, route metadata, and API handlers. Prefer Server Components; use small Client Components for browser interaction.
- Components live in PascalCase directories with `index.tsx`, colocated styles, and `type.ts` when needed. Preserve framework route filenames (`page.tsx`, `layout.tsx`, `not-found.tsx`). Shared tokens and primitives live in `src/styles/globals.css`.
- `web-assets` is the separate public content source. Keep content/provider access behind `src/lib`; never expose server credentials to client code. `src/lib/cms/schemas.ts` is the strict CMS schema authority.
- Preserve verified public routes, project slugs, links, artwork, attribution, and the full name in `web-assets/content/portfolio.json`. Do not invent content or outcomes.
- Read the installed Next.js guide in `node_modules/next/dist/docs/` before changing framework APIs; this project uses Next.js 16 conventions.
- Keep changes focused, preserve unrelated work, and do not commit unless asked.

## Data and release safety

CMS drafts and staged media live in browser Cache Storage until a confirmed submit publishes one GitHub commit. Conflicts must retain drafts; cache refresh retries must not write another commit. All content in the separate public GitHub repository is public, including unpublished project documents and revisions. Never treat initialization as a reset or overwrite.

Automated contact tests must not send real email. Live delivery requires an explicit request and verified provider/hostname setup. Do not merge, promote production, alter DNS/domains, or change production secrets without authorization. Verify the actual Vercel project, branch, commit, runtime, and target before any authorized deployment. Historical results are not evidence of current CI or production behavior.
