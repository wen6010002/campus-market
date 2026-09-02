#!/usr/bin/env bash
# V4.1 缓存优化专项验证：验证「主动失效」链路在真实链路上生效。
# 前置：管理员账号 admin@szu.edu.cn / demo1234；目标用户 stress001@szu.edu.cn / Stress1234
set -u
BASE="${1:-https://kedahub.cn}"
PASS=0; FAIL=0
ck() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "✔ $1"; else FAIL=$((FAIL+1)); echo "✘ $1 → $3（期望 $2）"; fi }
J() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1" 2>/dev/null; }

# 1) 目标用户登录拿到会话
c=$(curl -s -c /tmp/v41-a.jar -o /tmp/v41.json -w '%{http_code}' -X POST "$BASE/api/v1/auth/login" -H 'content-type: application/json' -d '{"email":"stress001@szu.edu.cn","password":"Stress1234"}')
ck "登录 stress001" 200 "$c"

# 2) /auth/me 正常（requireUser 状态缓存路径）
c=$(curl -s -b /tmp/v41-a.jar -o /tmp/v41.json -w '%{http_code}' "$BASE/api/v1/auth/me")
ck "auth/me（状态缓存生效路径）" 200 "$c"

# 3) 管理员封禁该用户 → 旧会话立即 403（缓存主动失效验证）
curl -s -c /tmp/v41-adm.jar -o /dev/null -X POST "$BASE/api/v1/auth/login" -H 'content-type: application/json' -d '{"email":"admin@szu.edu.cn","password":"demo1234"}'
c=$(curl -s -b /tmp/v41-adm.jar -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/admin/users/su_001/ban" -H 'content-type: application/json' -d '{"reason":"缓存验证临时封禁"}')
ck "管理员封禁" 200 "$c"
c=$(curl -s -b /tmp/v41-a.jar -o /tmp/v41.json -w '%{http_code}' "$BASE/api/v1/auth/me")
ck "封禁后旧会话立即 403（无 30s 延迟）" 403 "$c" "$(J "d['message']" </tmp/v41.json)"

# 4) 解封 → 会话恢复
c=$(curl -s -b /tmp/v41-adm.jar -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/admin/users/su_001/unban")
ck "解封" 200 "$c"
c=$(curl -s -b /tmp/v41-a.jar -o /dev/null -w '%{http_code}' "$BASE/api/v1/auth/me")
ck "解封后旧会话立即恢复" 200 "$c"

# 5) 公告发布 → 公共列表立即可见（列表缓存失效）
c=$(curl -s -b /tmp/v41-adm.jar -o /tmp/v41.json -w '%{http_code}' -X POST "$BASE/api/v1/admin/announcements" -H 'content-type: application/json' -d "{\"title\":\"缓存验证公告 $(date +%s)\",\"content\":\"verify\",\"level\":\"NORMAL\"}")
ANN_ID=$(J "d['data']['id']" </tmp/v41.json)
ck "发布公告" 201 "$c" "id=$ANN_ID"
c=$(curl -s -o /tmp/v41.json -w '%{http_code}' "$BASE/api/v1/announcements")
ck "公共列表立即可见新公告" 200 "$c" "$(J "'含' + str(d['pagination']['total']) + ' 条'" </tmp/v41.json)"

# 6) 已读 → me 未读数即时清零（me 缓存失效）
BEFORE=$(curl -s -b /tmp/v41-a.jar "$BASE/api/v1/auth/me" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['unreadAnnouncements'])")
curl -s -b /tmp/v41-a.jar -o /dev/null -X POST "$BASE/api/v1/announcements/read-all"
AFTER=$(curl -s -b /tmp/v41-a.jar "$BASE/api/v1/auth/me" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['unreadAnnouncements'])")
if [ "$BEFORE" -gt 0 ] && [ "$AFTER" = "0" ]; then PASS=$((PASS+1)); echo "✔ read-all 后未读数 $BEFORE -> 0（me 缓存即时失效）"; else FAIL=$((FAIL+1)); echo "✘ 未读数变化异常 $BEFORE -> $AFTER"; fi

# 7) 撤回验证公告（清理现场）
c=$(curl -s -b /tmp/v41-adm.jar -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/v1/admin/announcements/$ANN_ID")
ck "撤回验证公告（清理）" 200 "$c"

echo; echo "===== 缓存专项：$PASS 通过 / $FAIL 失败 ====="
[ "$FAIL" = "0" ]
