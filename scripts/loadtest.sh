#!/usr/bin/env bash
# Campus Market 压测脚本（autocannon，可复现）
# 前置：生产构建 pnpm build && pnpm start（或 docker 起 prod）
# 用法：bash scripts/loadtest.sh [BASE_URL]
set -euo pipefail

BASE="${1:-http://localhost:3000}"

run() {
  local name="$1"; local conn="$2"; local path="$3"
  echo ""
  echo "═══════════════════════════════════════════════════"
  echo "  压测：${name}（并发 ${conn}，10 秒）"
  echo "═══════════════════════════════════════════════════"
  pnpm dlx autocannon -c "$conn" -d 10 "${BASE}${path}" 2>&1 | tail -16
}

# 1. 健康检查（无 DB）
run "健康检查 /api/health" 100 "/api/health"

# 2. 作品列表（DB 查询）
run "作品列表 /works" 100 "/api/v1/works?page=1&pageSize=20"

# 3. 作品列表（高并发，观察连接池瓶颈）
run "作品列表 /works 高并发" 200 "/api/v1/works?page=1&pageSize=20"

# 4. 作品详情（多查询 + views 写入）
run "作品详情 /works/:id" 50 "/api/v1/works/w_db1"

# 5. 搜索（模糊查询）
run "搜索 /search" 50 "/api/v1/search?q=%E6%95%B0%E6%8D%AE%E5%BA%93"
