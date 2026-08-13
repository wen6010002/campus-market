# 进度记录（每阶段反思）

> 每阶段流程：实施 → 跑该阶段测试清单全绿 → 记录「做了什么 / 遇到什么问题 / 设计是否需调整 / 下阶段是否受影响」→ 进入下一阶段。

---

## 阶段 0 — 脚手架（B0）

**做了什么**

- `git init`（main 分支）+ husky(9) + commitlint + lint-staged + prettier 全链路。
- `package.json`：按 `BACKEND.md §2` 锁定技术栈（next ~14.2.5 / react 18 / ts 5.4 / prisma 5.18 / zod 3.23 / ioredis 5 / bullmq 5 / next-auth v5 beta / bcryptjs / nodemailer / aws-sdk s3 / pino / @sentry/nextjs / tanstack-query / zustand / r-h-f 等）。
- 基建文件：`tsconfig.json`、`next.config.mjs`(standalone + serverComponentsExternalPackages)、`vitest.config.ts`、`playwright.config.ts`、`.eslintrc.json`、`.prettierrc`、`commitlint.config.mjs`、`.lintstagedrc.json`、`.gitignore`、`.env.example`(全量字段+required 标注)。
- `docker/docker-compose.yml`(dev)：postgres16/redis7/minio(+createbuckets 自动建桶 campus-market)/mailhog，均带 healthcheck；`docker/Dockerfile`(多阶段 deps→build→run)。
- 源码骨架：`src/app/layout.tsx`、`src/app/page.tsx`(占位)、`src/app/globals.css`、`src/app/api/health/route.ts`、`src/lib/constants.ts`(契约 §1 全量枚举字典)。
- 目录结构按 `BACKEND.md §3` 全部建好。
- 测试：`tests/unit/constants.test.ts` 冒烟。

**测试清单结果**

- ✅ `pnpm install` 成功（pnpm 10.20）
- ✅ `pnpm typecheck` 通过
- ✅ `pnpm lint` 通过（0 警告 0 错误）
- ✅ `pnpm test` 通过（3/3）
- ✅ `pnpm dev` 启动，`/api/health` 返回 200，首页 200
- ⏳ `docker compose up -d` 三服务 healthy —— **被本机 Docker Desktop 阻塞**（见下）

**遇到的问题**

1. **pnpm 10 默认禁止依赖 postinstall 脚本**：首装后 `msgpackr-extract`(bullmq 依赖)、`msw` 的构建脚本被忽略。已在 `package.json` 加 `pnpm.onlyBuiltDependencies` 白名单解决。
2. **`process.env.NODE_ENV` 只读**：`@types/node` 中该字段只读，`tests/setup.ts` 直接赋值导致 typecheck 报错。已移除该赋值（测试环境由 vitest 自身设定）。
3. **husky 9 钩子文件不可执行**：Write 创建的文件无 +x，`git commit` 会静默跳过钩子。已 `chmod +x`。
4. **Docker Desktop 引擎未启动**：本机 Docker Desktop 弹出「需要管理员密码配置特权端口映射」的 macOS 授权框，osascript 卡住等待用户输入管理员密码。**需用户在弹出的密码框输入密码**，引擎才能起来，`compose up` 才能验证。代码层面 compose 文件已就绪。

**反思（阶段 0 命题：版本是否冲突？Auth.js v5 是否与 Next 14 兼容？）**

- **版本冲突：无致命冲突，两处需注意。** pnpm 10 vs 文档锁 pnpm 9 → 用「白名单」方案适配 pnpm 10，未降级（少一次下载）。Node 24 vs Next 14.2 → 实测 Next 14.2.35 在 Node 24 下 `dev`/编译/`typecheck` 全绿，无告警，**暂无需回退 Node 20**。保留 `.nvmrc` 选项作为兜底。
- **Auth.js v5 是否兼容 Next 14：待 B2 验证。** 阶段 0 尚未接入 auth，仅锁 `next-auth@beta` 依赖可安装。结论留待阶段 2 实际跑会话签发时给出，若 RSC/session 注入异常即按文档授权回退 NextAuth v4。

**下阶段是否受影响**

- 无。阶段 1（数据模型）只需 PG 可用；若 Docker 授权尚未完成，将先写 `prisma/schema.prisma` 与迁移 SQL，待引擎就绪再执行 `migrate`。
