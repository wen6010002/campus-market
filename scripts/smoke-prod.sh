#!/usr/bin/env bash
# 线上冒烟测试：V4 全部新接口 + 关键老接口 + 登录/写链路
set -u
BASE="${1:-http://154.222.19.224}"
PASS=0; FAIL=0
ck() { # name expected_status actual_status [extra]
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "✔ $1 → $3 ${4:-}"; else FAIL=$((FAIL+1)); echo "✘ $1 → $3（期望 $2）${4:-}"; fi
}
J() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1" 2>/dev/null; }

# ---- 动态发现真实业务 id（清库后旧固定 id 全失效） ----
J2() { python3 -c "import sys,json;print(json.load(sys.stdin)['data']$1)" 2>/dev/null; }
RM_ID=$(curl -s "$BASE/api/v1/roadmaps" | J2 "[0]['id']")
WK_ID=$(curl -s "$BASE/api/v1/works?page=1&pageSize=5" | J2 "[0]['id']")
echo "使用 路线图=$RM_ID 作品=$WK_ID"

# ---- 公开读 ----
c=$(curl -s -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/works?page=1&pageSize=5");  ck "GET works" 200 "$c" "共$(J "len(d['data'])" </tmp/sm.json)条"
c=$(curl -s -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/roadmaps");                 ck "GET roadmaps" 200 "$c" "共$(J "len(d['data'])" </tmp/sm.json)条"
c=$(curl -s -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/roadmaps/$RM_ID");      ck "GET roadmap详情" 200 "$c" "阶段$(J "len(d['data']['content']['phases'])" </tmp/sm.json)步$(J "d['data']['stepsCount']" </tmp/sm.json)"
c=$(curl -s -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/roadmaps/$RM_ID");      ck "GET roadmap关联资料" 200 "$c" "关联$(J "len(d['data']['works'])" </tmp/sm.json)条"
c=$(curl -s -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/announcements");            ck "GET announcements" 200 "$c" "共$(J "len(d['data'])" </tmp/sm.json)条"
c=$(curl -s -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/search?q=Java");            ck "GET search" 200 "$c"
c=$(curl -s -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/ranks/fav");                ck "GET ranks" 200 "$c"
c=$(curl -s -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/users/u_admin");                 ck "GET user详情" 200 "$c"
c=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/roadmaps");                           ck "页面 /roadmaps" 200 "$c"
c=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/announcements");                      ck "页面 /announcements" 200 "$c"
c=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/");                                   ck "页面 首页" 200 "$c"

# ---- 登录 demo ----
c=$(curl -s -c /tmp/sm.jar -o /tmp/sm.json -w '%{http_code}' -X POST "$BASE/api/v1/auth/login" -H 'content-type: application/json' -d '{"email":"smoke@szu.edu.cn","password":"Kedahub2026"}')
ck "POST login(smoke)" 200 "$c" "未读公告$(J "d['data']['user']['unreadAnnouncements']" </tmp/sm.json)"
c=$(curl -s -b /tmp/sm.jar -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/auth/me");         ck "GET me" 200 "$c"
c=$(curl -s -b /tmp/sm.jar -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/announcements/read-all"); ck "POST read-all" 200 "$c"
c=$(curl -s -b /tmp/sm.jar -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/auth/me");         ck "GET auth/me(已读后)" 200 "$c" "未读$(J "d['data']['unreadAnnouncements']" </tmp/sm.json)"
c=$(curl -s -b /tmp/sm.jar -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/me/roadmap-favorites"); ck "GET 我的路线图收藏" 200 "$c" "共$(J "len(d['data'])" </tmp/sm.json)条"
c=$(curl -s -b /tmp/sm.jar -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/roadmaps/$RM_ID/check" -H 'content-type: application/json' -d '{"stepId":"p0-s0","checked":true}'); ck "POST 打卡" 200 "$c"
c=$(curl -s -b /tmp/sm.jar -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/roadmaps/$RM_ID/progress"); ck "GET progress" 200 "$c" "连续$(J "d['data']['streakDays']" </tmp/sm.json)天/已勾$(J "d['data']['totalChecked']" </tmp/sm.json)"
c=$(curl -s -b /tmp/sm.jar -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/v1/works/$WK_ID/favorite"); ck "DELETE 取消收藏(幂等)" 200 "$c"

# ---- 登录 admin ----
c=$(curl -s -c /tmp/sm2.jar -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/auth/login" -H 'content-type: application/json' -d '{"email":"admin@szu.edu.cn","password":"Kedahub2026"}'); ck "POST login(admin)" 200 "$c"
c=$(curl -s -b /tmp/sm2.jar -o /dev/null -w '%{http_code}' "$BASE/api/v1/admin/stats");        ck "GET admin/stats" 200 "$c"
c=$(curl -s -b /tmp/sm2.jar -o /dev/null -w '%{http_code}' "$BASE/api/v1/admin/roadmaps/pending"); ck "GET 待审路线图" 200 "$c"
c=$(curl -s -b /tmp/sm2.jar -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/admin/users?page=1&pageSize=5"); ck "GET admin/users(ops详情)" 200 "$c" "共$(J "d['pagination']['total']" </tmp/sm.json)人"
c=$(curl -s -b /tmp/sm2.jar -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/admin/works?page=1&pageSize=5"); ck "GET admin/works" 200 "$c"
c=$(curl -s -b /tmp/sm2.jar -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/admin/orders?page=1&pageSize=5"); ck "GET admin/orders" 200 "$c"
c=$(curl -s -b /tmp/sm2.jar -o /tmp/sm.json -w '%{http_code}' "$BASE/api/v1/admin/users/u_admin");  ck "GET admin/users/u_admin(用户详情)" 200 "$c"

# ---- 权限反向验证 ----
c=$(curl -s -b /tmp/sm.jar -o /dev/null -w '%{http_code}' "$BASE/api/v1/admin/stats");   ck "smoke访问admin被拒" 403 "$c"
c=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/v1/auth/me");                          ck "未登录访问me被拒" 401 "$c"

# ---- V5 邮箱认证（只测负路径，不真实发信） ----
c=$(curl -s -o /tmp/sm.json -w '%{http_code}' -X POST "$BASE/api/v1/auth/send-code" -H 'content-type: application/json' -d '{"email":"a@gmail.com"}'); ck "send-code 非深大邮箱被拒" 400 "$c" "$(J "d['error']['code']" </tmp/sm.json)"
c=$(curl -s -o /tmp/sm.json -w '%{http_code}' -X POST "$BASE/api/v1/auth/forgot-password" -H 'content-type: application/json' -d '{"email":"a@pku.edu.cn"}'); ck "forgot-password 外校edu被拒" 400 "$c" "$(J "d['error']['code']" </tmp/sm.json)"
c=$(curl -s -o /tmp/sm.json -w '%{http_code}' -X POST "$BASE/api/v1/auth/reset-password" -H 'content-type: application/json' -d '{"email":"nobody@mails.szu.edu.cn","code":"000000","newPassword":"newpass123"}'); ck "reset-password 无码被拒" 400 "$c" "$(J "d['error']['code']" </tmp/sm.json)"
c=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/auth/change-password" -H 'content-type: application/json' -d '{"oldPassword":"x1234567","newPassword":"y1234567"}'); ck "change-password 未登录被拒" 401 "$c"
c=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/forgot-password");                     ck "页面 /forgot-password" 200 "$c"

echo; echo "===== 冒烟结果：$PASS 通过 / $FAIL 失败 ====="
[ "$FAIL" = "0" ]
