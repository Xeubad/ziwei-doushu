<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 项目约定（维护者要求）

- **用中文对话**：与本仓库维护者交流、解释方案、汇报进度时使用中文（简体中文）。代码、标识符、提交信息保持仓库现有风格（commit 主题可用中文，见 `git log`）。
- **协作者**：本仓库是 `Renhuai123/ziwei-doushu` 的 fork（`Xeubad/ziwei-doushu`）。数据集归属与 Releases 链接保持指向上游，clone 说明指向 fork。
- **网络**：直连 GitHub 会超时，`git push/pull` 与 `gh` 需走代理：`git -c http.proxy=http://127.0.0.1:7897`、`HTTPS_PROXY=http://127.0.0.1:7897`。
- **验证**：改动后跑 `npm run typecheck` 与 `npm test`（25 个回归脚本）。
