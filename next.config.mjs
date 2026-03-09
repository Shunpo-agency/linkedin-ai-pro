/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tell Next.js to NOT bundle these Node.js-only packages with webpack.
  // They get required natively at runtime from node_modules instead.
  // This prevents unstable webpack chunks and 500 errors in dev hot-reload.
  experimental: {
    serverComponentsExternalPackages: ['ioredis', 'bullmq'],
  },
}

export default nextConfig
