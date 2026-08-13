# Campus Market

大学生成长社区 + 校园知识内容市场（Next.js 14 全栈单项目）。

仿 B 站 UP 主生态：学生既是消费者也可成为创作者，浏览 / 免费下载 / 购买精品 / 关注 / 收藏 / 评分 / 上传；创作者通过免费作品积累影响力、通过精品获得收益、长期沉淀个人品牌。

## 文档

- [API 契约](./docs/API_CONTRACT.md) — 前后端唯一事实源
- [后端开发](./docs/BACKEND.md) — 阶段 0-10 执行规范
- [前端开发](./docs/FRONTEND.md) — 阶段 F0-F10 执行规范
- [部署启动](./docs/DEPLOY.md) — 本地 / 生产启动手册（全部阶段完成后提供）
- [进度记录](./docs/PROGRESS.md) — 每阶段反思

## 快速开始（开发）

```bash
# 1. 起基础设施（PG / Redis / MinIO / mailhog）
docker compose -f docker/docker-compose.yml up -d

# 2. 安装依赖
pnpm install

# 3. 准备环境变量
cp .env.example .env   # 按需修改 AUTH_SECRET 等

# 4. 迁移 + 生成 + 种子
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm db:seed

# 5. 启动
pnpm dev        # 终端 1：Web
pnpm worker     # 终端 2：定时任务
```

## 测试

```bash
pnpm test            # 单元 + 集成
pnpm test:cov        # 覆盖率
pnpm test:e2e        # Playwright E2E
```
