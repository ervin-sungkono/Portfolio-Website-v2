# Image delivery

The portfolio uses Next Image for large screenshots, artwork, the avatar, and organization logos. The October 2026 optimization pass addresses unnecessary Vercel Image Optimization variants and repeated revalidation without changing image frames, cover cropping, CSS transforms, tilt, or parallax.

## Sources and updates

`next.config.ts` derives remote patterns from `projects.json` and `designs.json`. Each URL constrains protocol, host, port, path, and query: GitHub sources accept no query; Dribbble sources retain their existing `?resize=1200x0`. Other paths or added query parameters are rejected. Adding a new content image automatically includes its exact URL in the next build, without opening the whole remote host.

The avatar, organization logos, and header logos use static imports from `public/images`. Next generates content-hashed URLs, so changed files get new cache identities. Only static build image paths without queries are accepted as local optimized sources. Original public files remain available for existing references and metadata. Tiny, native-resolution header logos bypass optimization; existing technology SVGs and animated GIFs also remain unoptimized.

`minimumCacheTTL` is 2,678,400 seconds (31 days), compared with Next 16.4's default four hours. The effective remote lifetime is the greater of that minimum and the upstream cache lifetime. This is appropriate for these stable assets, but a replacement at the same URL can remain stale. Publish remote replacements with a new filename/URL and update the content entry; arbitrary cache-busting queries are intentionally rejected. Static imports get immutable caching automatically.

## Responsive variants

The optimizer allows ten widths: 96, 192, 320, 480, 640, 768, 960, 1200, 1600, and 1920 pixels. This replaces Next's fifteen default widths and removes the 2048/3840 candidates above the existing source dimensions. Some original project files are wider than their JSX dimensions: Next Pokedex is 1887px, Easy Trip is 1907px, and YouTube Clone is 1909px. The 1920 rung preserves that native detail for large/high-density slots; Next's optimizer avoids enlarging smaller sources. Quality is pinned to 75 and optimized output uses WebP when accepted, retaining current defaults without adding another negotiated format or quality. Clients without WebP support can receive the original format.

`src/lib/image-sizes.ts` describes the existing 75rem container, fluid gutters/gaps, and actual page slots. Project collections use three desktop columns, two tablet columns, and one phone column; the tablet featured lead retains its full-width hint. Related projects retain two-column hints. Design closing pairs receive wider hints than the regular three-column rows. Homepage bento cards, teaser, hero, and unequal artwork columns each describe their own width. About imagery includes its avatar caps and logo widths.

These hints let the browser select a suitable source for viewport width and display density. They do not change the layout or force the same raster width everywhere. If grid proportions, gaps, container limits, or breakpoints change, update the corresponding hints and inspect actual `currentSrc` selections at 1×/2× density rather than relying on `srcset` alone.

## Cache and usage limits

Vercel's optimized-image cache is shared across deployments within the same project. Redeploying alone does not flush it. A new source URL or content hash, requested width, quality, or negotiated output format can create a distinct derivative. A longer lifetime reduces revalidation of existing derivatives; it does not eliminate the first transformation of a new variant or image delivery charges. No extra cache service is needed for this static portfolio.

Local production-build checks verify URL rejection, real raster output, cache reuse, and browser source selection. They do not measure Vercel billing or establish the cause of the historical production spike described in the owner's [shared discussion](https://chatgpt.com/share/6aca51d3-8d28-83ec-be40-717c2d2394be?ogimg=plain). See [verification](verification.md) for observed results. Production remains unchanged until an explicitly authorized release; assess hosted transformation counts and cache behavior then.
