import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: false,
  redirects() {
    return [{ source: '/engineering', destination: '/#engineering', permanent: true }];
  },
  images: {
    minimumCacheTTL: 2_678_400, // Stable portfolio assets: 31 days; replace the URL on updates.
    deviceSizes: [640, 768, 960, 1200, 1600, 1920],
    imageSizes: [96, 192, 320, 480],
    localPatterns: [{ pathname: '/_next/static/media/**', search: '' }],
    unoptimized: true, // FIXME: temporary fix until Vercel image optimization works again
  },
};

export default config;
