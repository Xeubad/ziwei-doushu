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
| `AI_ACCESS_TOKEN` | 否 | AI 接口访问口令；设置后请求须携带 `x-ai-token` 头（网页端会弹窗向用户收集） |
| `AI_RATE_LIMIT_PER_MIN` | 否 | 每 IP 每分钟请求上限（`0` 不限），默认解读 20 / 合盘 10 |
| `NEXT_PUBLIC_SITE_URL` | 否 | 站点对外地址（SEO canonical / 分享），默认 `http://localhost:3000` |
| `PORT` | 否 | compose 映射到宿主机的端口，默认 `3000` |

compose 会自动读入仓库根目录的 `.env.local`（没有也能启动）；原生 `docker run` 用 `--env-file` 注入。**密钥永远不要写进镜像**（`.dockerignore` 已排除所有 `.env*`）。

## 常用操作

```bash
docker compose -f docker/docker-compose.yml logs -f   # 看日志
docker compose -f docker/docker-compose.yml down      # 停止
docker compose -f docker/docker-compose.yml up -d --build   # 改代码后重建
```

## 更新部署（代码更新后）

容器镜像不可变，**不要在容器内改代码**（重启即丢）。更新 = 用新代码重建镜像，再用新镜像重建容器：

```bash
cd ziwei-doushu
git pull                                                      # 拉取新代码
docker compose -f docker/docker-compose.yml up -d --build     # 重建镜像 + 替换容器
```

- 构建在旧容器继续服务期间完成，切换只有几秒停机
- `package-lock.json` 没变时依赖层命中缓存，重建通常十几秒
- 应用无状态（对话存在浏览器 localStorage），重建容器不影响用户数据

只用原生 `docker run` 的等价流程：

```bash
git pull
docker build -f docker/Dockerfile -t ziwei-doushu:$(date +%Y%m%d) .
docker rm -f ziwei-doushu
docker run -d --name ziwei-doushu -p 3000:3000 --env-file .env.local ziwei-doushu:$(date +%Y%m%d)
```

### 回滚

保留旧 tag（上面按日期打 tag）即可秒级回滚：

```bash
docker images ziwei-doushu                      # 查看历史版本
docker rm -f ziwei-doushu
docker run -d --name ziwei-doushu -p 3000:3000 --env-file .env.local ziwei-doushu:<旧tag>
```

### 只改配置（不换代码）

改 `.env.local`（AI Key / 访问口令 / 限流）后重建容器即可，**不需要重新构建镜像**：

```bash
docker compose -f docker/docker-compose.yml up -d --force-recreate
```

### 换域名

`NEXT_PUBLIC_SITE_URL` 是构建期变量（打进 sitemap / canonical），换域名要带参数重建：

```bash
NEXT_PUBLIC_SITE_URL=https://your.site docker compose -f docker/docker-compose.yml up -d --build
```

分享链接用的是访问时的域名（`window.location.origin`），不受此项影响、无需重建。

## 实现说明

- **多阶段构建**（`docker/Dockerfile`）：`deps` 层缓存 npm 依赖 → `build` 层 `next build` → `runner` 层只拷贝 `.next/standalone` 产物 + 静态资源
- **standalone 输出**：`next.config.js` 仅在 `DOCKER_BUILD=1` 时启用 `output: 'standalone'`，不影响本地 `npm run dev / start`
- **构建上下文**：仓库根目录的 `.dockerignore` 排除了 `node_modules`、`.next`、`docs/`、`.env*` 等，镜像里只有运行所需代码
