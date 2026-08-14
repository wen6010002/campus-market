#!/usr/bin/env bash
# 生产部署脚本（V2-7）：拉代码 → 安装 → 迁移 → 构建 → 起服务
# 用法：bash scripts/deploy.sh
set -euo pipefail

echo "=== 1/6 拉取最新代码 ==="
git pull

echo "=== 2/6 安装依赖 ==="
pnpm install --frozen-lockfile

echo "=== 3/6 生成 Prisma client ==="
pnpm prisma:generate

echo "=== 4/6 应用数据库迁移 ==="
pnpm prisma:migrate:deploy

echo "=== 5/6 构建生产版本 ==="
pnpm build

echo "=== 6/6 起服务（app + worker + 基础设施） ==="
docker compose -f docker/docker-compose.prod.yml up -d --build app worker

echo "✅ 部署完成，健康检查：curl http://localhost/api/health"
