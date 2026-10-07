import type { NextConfig } from 'next';
import projects from './src/content/projects.json';
import designs from './src/content/designs.json';

const config: NextConfig = {
  poweredByHeader: false,
  images: {
    minimumCacheTTL: 2_678_400, // Stable portfolio assets: 31 days; replace the URL on updates.
    deviceSizes: [640, 768, 960, 1200, 1600, 1920],
    imageSizes: [96, 192, 320, 480],
    qualities: [75],
    formats: ['image/webp'],
    localPatterns: [{ pathname: '/_next/static/media/**', search: '' }],
    // Match complete paths and queries, including Dribbble's existing resize parameter.
    remotePatterns: [...projects, ...designs].map(({ image }) => new URL(image)),
  },
};

export default config;
