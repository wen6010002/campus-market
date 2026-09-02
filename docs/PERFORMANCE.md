# 性能压测报告与优化方案（v0.2.1）

> 2026-09-02 · 生产机 154.222.19.224（CentOS 7 · 4C/3.7G · Docker Compose：Caddy + app + worker + PgBouncer + PostgreSQL 16 + Redis 7 + MinIO）
> 压测工具：`scripts/stress.mjs`（零依赖 Node 闭環负载发生器，压测账号由 `scripts/stress-users.ts` 生成，共 60 个）
> 原始数据：`scripts/stress-results/*.json`（A1-A4 读、B1-B2 混合、C2 写、D2 登录、E 直连对比、F 公网用户视角；服务器侧同目录留有副本）

## 一、结论速览

| 指标 | 结果 |
|---|---|
| 读接口容量 | **~125-137 RPS 封顶**（10/25/50/100 并发均在此区间，100 并发时吞吐反降至 107） |
| 混合负载容量 | ~93 RPS（读 + 登录态 + 限速写） |
| 纯写容量 | 80 RPS @30 并发（打卡 25.6/s、收藏/点赞各 27/s） |
| 并发登录延迟 | **单次 4.4s**（p50，10 并发登录；bcrypt-12 在单进程串行排队） |
| 错误率 | **全程 0 错误**（无一 5xx/网络错误；过载表现为延迟上升而非失败） |
| 限流器 | 实测精确（login 10/min/邮箱、check 60/min/用户，429 干净返回） |
| 资源水位 | app 单核 70%，PostgreSQL/Redis/Caddy/PgBouncer 全部 <1%，app 内存 73M/512M |

**瓶颈唯一且明确：Next.js standalone 单进程**。数据库、缓存、反代全部空闲，单 Node 进程（框架中间件 + 路由 + 业务序列化 ≈ 5ms CPU/请求）在 0.7 核处饱和。垂直方向 4 核只用了不到 1 核。

## 二、测试矩阵与关键数据

### A 系列：公开读（经 Caddy）

| 并发 | 总吞吐 | works p50(30s缓存) | search p50(无缓存) | roadmapDetail p50(无缓存) | 错误 |
|---|---|---|---|---|---|
| 10 | 137.2 RPS | 40ms | 95ms | 61ms | 0 |
| 25 | 117.0 RPS | 64ms | 297ms | 523ms | 0 |
| 50 | 125.3 RPS | 226ms | 454ms | 752ms | 0 |
| 100 | 107.2 RPS | 379ms | 1107ms | 1907ms（max 11.4s） | 0 |

- 10→100 并发吞吐不升反降：**~125 RPS 即单进程服务上限**，超过后纯排队。
- 缓存分层清晰可见：有 Redis 缓存的 works/ranks 过载时仍最快；无缓存的 roadmaps/announcements/search/userProfile 排队最重。

### B 系列：混合负载（读 + 登录态 + 限速写，最接近真实流量）

B1(25 并发) 92.4 RPS ≈ B2(50 并发) 93.5 RPS，0 错误。B2 分场景 p50：works 137ms < roadmaps 285ms ≈ announcements 284ms < me 678ms < check 697ms < roadmapDetail 765ms < workLike 752ms。

### C 系列：写专项（30 并发 / 90s，配速遵守服务端限流）

| 场景 | 成功 RPS | p50 | p99 | 429 |
|---|---|---|---|---|
| 打卡 check | 25.6/s | 155ms | 394ms | 0 |
| 收藏 workFav | 27.3/s | 234ms | 535ms | 0 |
| 点赞 workLike | 27.2/s | 236ms | 521ms | 0 |

（C 首轮曾出现 1228 个 429，系压测脚本配速缺陷绕过 minInterval 所致——恰好实证了服务端限流的准确性；修复脚本后 C2 全 200。）

### D 系列：登录专项（10 并发，限流 10/min/邮箱内）

- 90s 成功登录 130 次，**单次 p50=4390ms / p99=4643ms**。
- 根因：`hashPassword/verifyPassword` 用 bcrypt cost=12（单次 ~250-350ms 纯 CPU），单进程 event loop 上并发登录完全串行：10 个并发 ≈ 10×300ms+ 排队 ≈ 4s+。单用户低峰登录 ~300ms 正常。

### E 系列：直连 app:3000（50 并发读）

125.7 RPS vs 经 Caddy 的 125.3 → **Caddy 开销 <0.5%，可忽略**，反代无优化必要。

### F 系列：公网真实用户视角（本机 → https://kedahub.cn，15 并发混合）

91.2 RPS，各场景 p50 114-250ms（含公网 RTT ~100ms），0 错误。**线上真实用户当前体验良好**。

## 三、优化方案（按 ROI 排序）

### P0-1 应用多副本横向扩展（预期 ×2.5-3，改动最小收益最大）

瓶颈是单进程而机器还有 3 个空闲核。Docker Compose 原生支持：

```yaml
# docker-compose.prod.yml 的 app 服务
services:
  app:
    # container_name: cm-app   ← 必须删除（scale 时命名冲突）
    deploy:
      replicas: 3               # 4C 机器配 3 个 app 进程 + 1 worker
      resources:
        limits: { memory: 512M }
```

- Caddy 的 `reverse_proxy app:3000` 会自动拿到 Docker DNS 的多条 A 记录并轮询负载均衡，**Caddyfile 无需改动**。
- 内存：3×512M 上限 + 现有服务 ~1.1G，3.7G 机器可容纳（实测单副本仅用 73M）。
- 数据库连接：3 进程 × Prisma 默认池(≈10-20) = 30-60，PgBouncer `MAX_CLIENT_CONN=200 / POOL_SIZE=20` 足够。
- 验证：改配置后重跑 A/B 矩阵，预期读 ~300+ RPS。
- 风险：低。应用无本地状态（会话是 JWT、缓存是 Redis、文件是 MinIO），天然可水平扩展。

### P0-2 requireUser 封禁检查加短缓存（省 1 次 PG 往返/每个登录态请求）

`src/server/auth/session.ts` 的 `requireUser()` 每次请求都 `findUnique` 查 user 状态。B2 中所有登录态接口 p50 都比公开接口高 ~300-400ms，此处是主要差额来源之一。

```ts
// 模式：user:{id}:status → 'OK' | 'BANNED'，TTL 30s；
// ban/unban 时主动 cacheDel（做到准实时），缓存 miss 才查库
```

封禁生效延迟从「即时」变为「≤30s（主动失效后即时）」——对校园产品完全可接受。

### P1-1 roadmaps / announcements 列表加缓存（照抄 works:list 模式）

`workService.list` 的 `works:list:{q}` 30s Redis 缓存已被压测证明有效（过载时仍是全场最快）。roadmaps 列表、announcements 列表当前直查 PG：

- `roadmaps:list:{query}` TTL 60s；失效点：上传审核通过、上下架、收藏数变更（`cacheDelByPattern('roadmaps:list:*')`）。
- `announcements:list:{unread?}` TTL 60s；失效点：发布/撤回。
- roadmapDetail 的 `content+works` 公共部分可缓存（TTL 300s，内容不可变），`myFav` 保持单独查询。

### P1-2 搜索短缓存 + 补 trgm 索引

search 无缓存且是全场过载时第二慢（100 并发 p50 1.1s）：

- 热词短缓存：`search:{kw}` TTL 5-10s（首页搜索框高频重复词收益大）。
- 现有 trgm GIN 索引只覆盖 works 三列；`users.username`、`creator.direction` 的 ILIKE 查询无索引，数据涨后会顺序扫描 → 补两个 trgm 迁移。

### P1-3 /auth/me 聚合优化

`buildAuthUser` 每次并发 3 个查询（user + 未读通知 count + 未读公告 count）。Nav 每个页面都会拉它。方案：未读计数改为写时增减的 Redis 计数（通知/公告写入时 INCR，读时 GET），user 部分配合 P0-2 的状态缓存。

### P2-1 登录排队体验

并发登录 p50 4.4s 的三层解法（按成本递增）：

1. **P0-1 多副本本身就解决大半**：3 进程并行做 bcrypt，10 并发登录 p50 预计降至 ~1.5s。
2. bcrypt cost 12 保持不动（安全边界，校园产品登录频次低）。
3. 若未来有开学季注册洪峰，再把登录拆独立可扩容服务（当前无必要）。

### P2-2 观测与守护（非性能，但压测时确认的隐患）

- `cm-postgres`/`cm-redis`/`cm-minio` 均**未配置 `restart` 以外的资源限制与健康告警**；建议加 `docker stats` 采样的简易 cron 告警（压测用的 `scripts/stress-monitor.sh` 可直接复用）。
- backup 容器只保留 7 份日备，未做异地备份——MinIO 卷与 pg_dump 同机，机器故障会同时丢数据。建议 rclone/OSS 异地同步。
- 建议 PG 开 `pg_stat_statements`，下次压测可直接定位 TOP SQL。

## 四、容量对照（改完 P0 后的预期）

| 配置 | 读 | 混合 | 说明 |
|---|---|---|---|
| 现状（单副本） | ~125 RPS | ~93 RPS | 0 错误，50 并发内 p99 < 1.5s |
| P0-1 ×3 副本 | ~300-375 RPS | ~250 RPS | 瓶颈转移至 PG 连接/带宽（当前仍远未到） |
| + P1 缓存全套 | 视命中率 +50-100% | — | 热点页（works/roadmaps 列表）多数请求不再触库 |

对照业务规模：深大全校 ~4 万人，假设日活 3000、高峰分钟级在线 300（点击率 ~1 次/10s ≈ 30 RPS）——**现状容量已是日常峰值 4 倍**，P0-1 后有 ~10 倍余量，足够支撑开学季/推广期。

## 五、复现方式

```bash
# 服务器上（容器内跑，排除压测机网络因素）
docker compose -f docker/docker-compose.prod.yml run --rm \
  -v $PWD/scripts:/app/scripts migrate node scripts/stress.mjs \
  --base http://154.222.19.224 --vu 50 --dur 60 --mix mixed \
  --out /app/scripts/stress-results/result.json

# 压测账号（幂等）：docker compose -f docker/docker-compose.prod.yml run --rm \
  -v $PWD/scripts:/app/scripts -v $PWD/src:/app/src migrate pnpm tsx scripts/stress-users.ts 60
# 资源采样：sh scripts/stress-monitor.sh 60
```

压测账号说明：`stress001@szu.edu.cn .. stress060`（密码 `Stress1234`，60 个，`su_` 前缀 id），保留在线上供回归压测复用；如需清理可在 /ops 用户管理按前缀识别删除。
