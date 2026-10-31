/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lunar-javascript'],
  // Docker 镜像构建（docker/Dockerfile 设 DOCKER_BUILD=1）输出自包含的
  // .next/standalone，镜像无需 node_modules；本地 npm run dev / start 不受影响。
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' } : {}),
};

module.exports = nextConfig;
