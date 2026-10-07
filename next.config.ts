import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '/ervin-sungkono/web-assets/master/images/**',
      },
      { protocol: 'https', hostname: 'cdn.dribbble.com', pathname: '/userupload/**' },
    ],
  },
};

export default config;
