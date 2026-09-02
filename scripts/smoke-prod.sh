#!/usr/bin/env bash
# 线上冒烟测试：V4 全部新接口 + 关键老接口 + 登录/写链路
set -u
BASE="${1:-http://154.222.19.224}"
PASS=0; FAIL=0
ck() { # name expected_status actual_status [extra]
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "✔ $1 → $3 ${4:-}"; else FAIL=$((FAIL+1)); echo "✘ $1 → $3（期望 $2）${4:-}"; fi
}
J() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1" 2>/dev/null; }

# ---- 公开读 ----
c=$(curl -s -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/works?page=1&pageSize=5");  ck "GET works" 200 "$c" "共$(J "len(d['data'])" </tmp/sm.json)条"
c=$(curl -s -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/roadmaps");                 ck "GET roadmaps" 200 "$c" "共$(J "len(d['data'])" </tmp/sm.json)条"
c=$(curl -s -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/roadmaps/rm_backend");      ck "GET roadmap详情" 200 "$c" "阶段$(J "len(d['data']['content']['phases'])" </tmp/sm.json)步$(J "d['data']['stepsCount']" </tmp/sm.json)"
c=$(curl -s -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/roadmaps/rm_backend");      ck "GET roadmap关联资料" 200 "$c" "关联$(J "len(d['data']['works'])" </tmp/sm.json)条"
c=$(curl -s -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/announcements");            ck "GET announcements" 200 "$c" "共$(J "len(d['data'])" </tmp/sm.json)条"
c=$(curl -s -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/search?q=Java");            ck "GET search" 200 "$c"
c=$(curl -s -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/ranks/fav");                ck "GET ranks" 200 "$c"
c=$(curl -s -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/users/u0");                 ck "GET user详情" 200 "$c"
c=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/roadmaps");                           ck "页面 /roadmaps" 200 "$c"
c=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/announcements");                      ck "页面 /announcements" 200 "$c"
c=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/");                                   ck "页面 首页" 200 "$c"

# ---- 登录 demo ----
c=$(curl -s -c /tmp/sm.jar -o /tmp/sm.json -w '%{http_code}' -X POST "$BASE/api/v1/auth/login" -H 'content-type: application/json' -d '{"email":"demo@szu.edu.cn","password":"demo1234"}')
ck "POST login(demo)" 200 "$c" "未读公告$(J "d['data']['user']['unreadAnnouncements']" </tmp/sm.json)"
c=$(curl -s -b /tmp/sm.jar -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/auth/me");         ck "GET me" 200 "$c"
c=$(curl -s -b /tmp/sm.jar -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/announcements/read-all"); ck "POST read-all" 200 "$c"
c=$(curl -s -b /tmp/sm.jar -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/auth/me");         ck "GET auth/me(已读后)" 200 "$c" "未读$(J "d['data']['unreadAnnouncements']" </tmp/sm.json)"
c=$(curl -s -b /tmp/sm.jar -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/me/roadmap-favorites"); ck "GET 我的路线图收藏" 200 "$c" "共$(J "len(d['data'])" </tmp/sm.json)条"
c=$(curl -s -b /tmp/sm.jar -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/roadmaps/rm_backend/check" -H 'content-type: application/json' -d '{"stepId":"p0-s0","checked":true}'); ck "POST 打卡" 200 "$c"
c=$(curl -s -b /tmp/sm.jar -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/roadmaps/rm_backend/progress"); ck "GET progress" 200 "$c" "连续$(J "d['data']['streakDays']" </tmp/sm.json)天/已勾$(J "d['data']['totalChecked']" </tmp/sm.json)"
c=$(curl -s -b /tmp/sm.jar -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/v1/works/w_db1/favorite"); ck "DELETE 取消收藏(幂等)" 200 "$c"

# ---- 登录 admin ----
c=$(curl -s -c /tmp/sm2.jar -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/auth/login" -H 'content-type: application/json' -d '{"email":"admin@szu.edu.cn","password":"demo1234"}'); ck "POST login(admin)" 200 "$c"
c=$(curl -s -b /tmp/sm2.jar -o /dev/null -w '%{http_code}' "$BASE/api/v1/admin/stats");        ck "GET admin/stats" 200 "$c"
c=$(curl -s -b /tmp/sm2.jar -o /dev/null -w '%{http_code}' "$BASE/api/v1/admin/roadmaps/pending"); ck "GET 待审路线图" 200 "$c"
c=$(curl -s -b /tmp/sm2.jar -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/admin/users?page=1&pageSize=5"); ck "GET admin/users(ops详情)" 200 "$c" "共$(J "d['pagination']['total']" </tmp/sm.json)人"
c=$(curl -s -b /tmp/sm2.jar -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/admin/works?page=1&pageSize=5"); ck "GET admin/works" 200 "$c"
c=$(curl -s -b /tmp/sm2.jar -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/admin/orders?page=1&pageSize=5"); ck "GET admin/orders" 200 "$c"
c=$(curl -s -b /tmp/sm2.jar -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/admin/users/u0");  ck "GET admin/users/u0(用户详情)" 200 "$c"

# ---- 权限反向验证 ----
c=$(curl -s -b /tmp/sm.jar -o /dev/null -w '%{http_code}' "$BASE/api/v1/admin/stats");   ck "demo访问admin被拒" 403 "$c"
c=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/v1/auth/me");                          ck "未登录访问me被拒" 401 "$c"

echo; echo "===== 冒烟结果：$PASS 通过 / $FAIL 失败 ====="
[ "$FAIL" = "0" ]
