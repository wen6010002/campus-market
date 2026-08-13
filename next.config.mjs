/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    // lint 由独立 `pnpm lint` 与 CI 执行，避免 next build 因 lint 失败阻塞
    ignoreDuringBuilds: false,
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'pino', 'pino-http'],
  },
};

export default nextConfig;
