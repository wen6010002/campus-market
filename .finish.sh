#!/bin/bash
cd /Users/wenhaoxuan/Desktop/campus-market
rm -f .cwd-test .run-e2e.sh
git add -A
git commit -m "test(e2e): 补全 7 条核心路径 E2E 测试

- e2e/helpers.ts(登录/注册/读验证码/admin API)
- e2e/paths.spec.ts 7 条路径全绿(注册购买评分/关注/发布审核/收藏/举报/收益/搜索)
- MinIO 加 CORS(直传跨域修复)
- 本地 DATABASE_URL_POOLED 回退直连(PgBouncer 认证待生产配)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" 2>&1 | tail -5
git push 2>&1 | tail -3
