/** @type {import('next').NextConfig} */

const nextConfig = {
  env: {
    NEXT_PUBLIC_COMMIT_HASH: (() => {
      try {
        return require('child_process').execSync('git rev-parse --short HEAD').toString().trim();
      } catch (e) {
        return 'unknown';
      }
    })(),
  },
  output: 'export',
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
