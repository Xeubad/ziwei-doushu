# Docker 部署

单容器部署：Next.js 16 生产构建（`output: 'standalone'`），镜像内不含 `node_modules`，非 root 运行，自带健康检查。

## 快速开始

```bash
# 方式一：compose（推荐）
docker compose -f docker/docker-compose.yml up -d
open http://localhost:3000

# 方式二：原生 docker 命令（在仓库根目录执行）
docker build -f docker/Dockerfile -t ziwei-doushu .
docker run -d --name ziwei-doushu -p 3000:3000 --env-file .env.local ziwei-doushu
```

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `AI_PROVIDER` / `DEEPSEEK_API_KEY` 等 | 否 | AI 解读 / 合盘分析的模型配置，见根目录 `.env.example`。不配则排盘照常可用，AI 接口返回 `503 ai-not-configured` |
| `NEXT_PUBLIC_SITE_URL` | 否 | 站点对外地址（SEO canonical / 分享），默认 `http://localhost:3000` |
| `PORT` | 否 | compose 映射到宿主机的端口，默认 `3000` |

compose 会自动读入仓库根目录的 `.env.local`（没有也能启动）；原生 `docker run` 用 `--env-file` 注入。**密钥永远不要写进镜像**（`.dockerignore` 已排除所有 `.env*`）。

## 常用操作

```bash
docker compose -f docker/docker-compose.yml logs -f   # 看日志
docker compose -f docker/docker-compose.yml down      # 停止
docker compose -f docker/docker-compose.yml up -d --build   # 改代码后重建
```

## 实现说明

- **多阶段构建**（`docker/Dockerfile`）：`deps` 层缓存 npm 依赖 → `build` 层 `next build` → `runner` 层只拷贝 `.next/standalone` 产物 + 静态资源
- **standalone 输出**：`next.config.js` 仅在 `DOCKER_BUILD=1` 时启用 `output: 'standalone'`，不影响本地 `npm run dev / start`
- **构建上下文**：仓库根目录的 `.dockerignore` 排除了 `node_modules`、`.next`、`docs/`、`.env*` 等，镜像里只有运行所需代码
