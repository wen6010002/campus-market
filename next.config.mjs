/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    // lint 由独立 `pnpm lint` 与 CI 执行，避免 next build 因 lint 失败阻塞
    ignoreDuringBuilds: false,
  },
  experimental: {
    // @node-rs/bcrypt：原生 napi 模块（.node 二进制），webpack 无法打包，外部化后运行时 require
    serverComponentsExternalPackages: ['@prisma/client', 'pino', 'pino-http', '@node-rs/bcrypt'],
  },
};

export default nextConfig;
