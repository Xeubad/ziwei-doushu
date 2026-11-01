# ─────────────────────────────────────────────────────────────
# 紫微命盘 · Next.js 16 多阶段构建
#
#   构建（在仓库根目录执行）：
#     docker build -f docker/Dockerfile -t ziwei-doushu .
#   或直接用 compose：
#     docker compose -f docker/docker-compose.yml up -d
#
# 说明：构建时设 DOCKER_BUILD=1 走 next.config.js 的 output:'standalone'，
# 产物 .next/standalone 自包含运行时依赖，最终镜像不含 node_modules。
# ─────────────────────────────────────────────────────────────

# ── 1. 依赖层（package*.json 不变则命中缓存）──
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

# ── 2. 构建层 ──
FROM node:22-alpine AS build
WORKDIR /app
# NEXT_PUBLIC_SITE_URL 是构建期变量（sitemap / canonical 等静态产物用）：
#   docker compose -f docker/docker-compose.yml up -d --build
#   NEXT_PUBLIC_SITE_URL=https://your.site docker compose ... up -d --build
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_TELEMETRY_DISABLED=1 \
    DOCKER_BUILD=1 \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── 3. 运行层（只带 standalone 产物）──
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# 非 root 运行
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
