/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.dribbble.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
}

// const withBundleAnalyzer = require('@next/bundle-analyzer')({
//   enabled: true,
//   openAnalyzer: false
// })

module.exports = nextConfig /* withBundleAnalyzer(nextConfig) */
