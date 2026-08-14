# Campus Market — 版本二设计文档（V2）

> **给执行者的守则（先读）**
>
> 1. 本文档是版本二的**唯一执行规范**，与 `BACKEND.md`/`FRONTEND.md` 同一权威级别。所有字段、函数签名、配置、SQL 以本文档为准。
> 2. 每个阶段完成后**必须**跑该阶段测试清单，全绿后再进入下一阶段；每阶段末把「做了什么/问题/反思」追加到 `docs/PROGRESS.md`。
> 3. 涉及钱（支付/退款/提现）、权限（封号/审核）、外部回调（支付 webhook）的逻辑必须**事务 + 幂等键**。
> 4. 任何「TODO/暂略」都视为未完成。
> 5. 版本二是「生产化」升级，**不改动已通过测试的核心契约**（API 响应结构、数据库表名/字段），只做增强与补全。

---

## 0. 版本二总览

### 0.1 为什么做版本二

版本一（B0–B10 + F0–F10）已交付「全栈可运行 + 77 测试全绿」，但存在三类问题：

1. **支付是 mock**：下单即成功，未接真实微信/支付宝下单；前端无二维码收银台。
2. **性能未调优**：压测显示 200 并发时 DB 连接池耗尽（p99 从 254ms 飙到 2.6s 并超时）；无缓存、views 计数同步写 DB、排行榜/搜索无缓存无索引。
3. **管理后台残缺**：只有作品审核 + 举报两个 Tab，提现审批/创作者认证后端已就绪但前端未接，用户管理（封号/解封/改角色）连后端都没有。

此外，版本一还遗留了 BACKEND.md 验收清单里的欠账（安全加固、E2E、覆盖率、评论功能、成就触发、CI、可观测），一并纳入版本二。

### 0.2 版本二验收清单（完成后逐项打勾）

- [ ] 真实支付：微信 v3 Native 真正下单（fetch + RSA 签名）、支付宝 page.pay 真正下单（RSA2 签名）、前端二维码收银台 + 订单轮询、退款、查单对账。
- [ ] 性能：PgBouncer 连接池、Redis 缓存列表/详情/排行、views 异步计数、搜索 pg_trgm 索引。压测 200 并发 p99 < 500ms、无超时。
- [ ] 管理后台：提现审批、创作者认证、用户管理（封号/解封/改角色）、数据看板。
- [ ] 安全：CSRF（Origin/Referer 校验）、XSS（sanitize-html 白名单）、限流补全（上传/举报）。
- [ ] 功能补全：评论、通知中心（read-all/已读）、成就触发。
- [ ] 测试：Playwright E2E 7 条核心路径全绿、单测≥90%、集成≥85%、GitHub Actions CI（lint/typecheck/test）。
- [ ] 可观测：requestId + 访问日志（pino-http）、Sentry（可选）。
- [ ] 部署：生产部署脚本 + 文档更新（`docs/DEPLOY.md` 补 PgBouncer/真实支付上线）。

### 0.3 阶段划分与依赖

| 阶段 | 主题                                                 | 依赖                           |
| ---- | ---------------------------------------------------- | ------------------------------ |
| V2-1 | 真实支付 + 退款 + 前端收银台                         | 无（基于 V1 已就绪的支付抽象） |
| V2-2 | 性能优化（PgBouncer/Redis 缓存/views 异步/搜索索引） | 无                             |
| V2-3 | 管理后台完善 + 用户管理 + 数据看板                   | 无                             |
| V2-4 | 安全加固（CSRF/XSS/限流）                            | 无                             |
| V2-5 | 功能补全（评论/通知/成就）                           | 无                             |
| V2-6 | 测试与 CI（E2E/覆盖率/GitHub Actions）               | V2-1~V2-5 全部完成             |
| V2-7 | 可观测与部署（日志/Sentry/部署脚本/文档）            | V2-1~V2-6 全部完成             |

> V2-1 ~ V2-5 相互独立，可并行；V2-6、V2-7 必须等前面完成。

---

## 0.4 关键业务决策（收款 / 退款 / 原创保护）

> 这三条是**业务规则**，不是纯代码问题。执行 V2-1/V2-5 前必须先读。

### 0.4.1 收款方与分账

**钱怎么走**：

```
买家付款 → 进入【平台商户号】(微信/支付宝，需营业执照)
        → 平台抽成 10%（PLATFORM_FEE_RATE）
        → 剩余 90% 记入创作者钱包（Wallet，平台内记账）
        → 创作者提现 → 平台从商户号打款到创作者（企业付款/转账）
```

**硬性前置条件**：微信支付/支付宝的收款方必须是**商户主体**（营业执照），个人/学生无法申请商户号。因此：

| 场景               | 收款方案                                                           |
| ------------------ | ------------------------------------------------------------------ |
| 演示 / 毕设 / 学习 | `PAYMENT_MODE=mock`（现状），或微信/支付宝**沙箱**环境             |
| 真实上线           | 需一个营业执照主体（学校创业园 / 导师公司 / 家人个体户）申请商户号 |

**提现打款**（真实上线时）：

- 微信：企业付款到零钱（商户号开通）或分账能力
- 支付宝：转账 `alipay.fund.trans.toaccount.transfer`

> **结论**：V2-1 完成的是「下单/回调/退款」的**代码**；真实收款仍**必须有一个商户号主体**，这不是代码能解决的。代码层面分账/提现逻辑已就绪（`Wallet` / `Payout` / `adminService.auditPayout`），只缺商户号与打款通道。

### 0.4.2 退款规则（数字商品）

资料是虚拟商品，**下载即完成交付，无法「退回」**。退款分两类：

| 类型     | 触发者 | 条件                                                | 结果                                |
| -------- | ------ | --------------------------------------------------- | ----------------------------------- |
| 自助退款 | 买家   | 支付后**未下载** + 24h 内 + `payStatus=PAID`        | 退款 + 撤销下载权                   |
| 平台退款 | 管理员 | 侵权下架 / 内容与描述严重不符 / 文件损坏 / 重复扣款 | 退款 + 撤销下载权 + 冲减收益 + 通知 |

**核心原则**：已下载 → 原则上**不可自助退款**；特殊情况（侵权 / 货不对板 / 文件损坏）由平台核实后**主动退**（管理员触发，见 V2-3 的提现审批旁新增「订单退款」管理入口）。

### 0.4.3 原创保护与防重复上架

1. **原创标签**：`Work` 加 `isOriginal Boolean @default(true)`（上传时用户声明「原创 / 整理 / 转载」），前端展示「原创」徽标。
2. **文件指纹去重**：上传时前端计算文件 SHA256（`crypto.subtle.digest`）→ 后端校验 `work.fileSha` 是否已存在 → 重复则拒绝上架（「该文件已在平台」），防止购买后转卖重复上传。
3. **举报闭环**：已有 `Report`（侵权）→ 平台下架 + 退购买者款 + 封号（重复侵权加重）。

---

## V2-1 真实支付与退款

### 目标

把 mock 支付替换为真实微信 v3 Native + 支付宝电脑网站支付；前端出二维码收银台 + 订单轮询；补退款与查单。

### 改动清单

#### 1.1 微信 v3 Native 真正下单（改 `src/server/payment/wechat.ts`）

**现状**：`createOrder` 只返回假 `code_url`；`verifyNotify` 有 AES-GCM 解密但验签只在配了平台证书时做；`queryOrder` 占位。

**改法**：

- 新增 `wechatRequest(method, path, body)` 私有函数：发 HTTPS 请求到 `https://api.mch.weixin.qq.com`，用 `crypto.ts` 的 `rsaSign` 构建 `Authorization: WECHATPAY2-SHA256-RSA2048` 头。
- `createOrder(order)`：
  1. 若 `!MCHID || !APPID || !私钥 || !WECHAT_NOTIFY_URL` → 抛 `appError('INTERNAL', '微信支付未配置')`。
  2. 请求体：`{ appid: APPID, mchid: MCHID, description: order.title, out_trade_no: order.id, notify_url: WECHAT_NOTIFY_URL, amount: { total: 分, currency: 'CNY' } }`（金额单位是**分**，`Math.round(order.amount*100)`）。
  3. `POST /v3/pay/transactions/native`，解析响应的 `code_url` 返回 `{ provider:'wechat', codeUrl }`。
- `verifyNotify(req)`：**补全验签**——用平台证书（`WECHAT_PLATFORM_CERT_PATH`）验 `Wechatpay-Signature`（消息串 = `timestamp\nnonce\n{resource原文}\n`）；再解密 resource（已实现）；若未配平台证书则**拒绝**（生产必须验签，不留跳过分支）。
- `queryOrder(outTradeNo)`：`GET /v3/pay/transactions/out-trade-no/{outTradeNo}?mchid=...`，按 `trade_state` 映射 `SUCCESS→PAID / NOTPAY→PENDING / CLOSED→CLOSED / 其他→FAILED`。

#### 1.2 支付宝电脑网站支付（改 `src/server/payment/alipay.ts`）

- `createOrder(order)`：
  1. 构建 `biz_content` JSON：`{ out_trade_no: order.id, total_amount: order.amount.toFixed(2), subject: order.title, product_code: 'FAST_INSTANT_TRADE_PAY' }`。
  2. 公共参数 + biz_content 按 ASCII 排序拼接为待签串，`rsaSign`（应用私钥）生成 `sign`。
  3. 返回 `{ provider:'alipay', redirectUrl: 'https://openapi.alipay.com/gateway.do?' + 参数 + '&sign=' + sign }`。
- `queryOrder(outTradeNo)`：`alipay.trade.query`，`TRADE_SUCCESS/FINISHED→PAID`，`WAIT_BUYER_PAY→PENDING`，`TRADE_CLOSED→CLOSED`。

#### 1.3 支付抽象扩展（改 `src/server/payment/index.ts`）

- `PayProvider` 接口新增 `refund(order, amount, reason): Promise<{ refundId }>`。
- `mock.ts` 补 `refund`（直接返回 refundId）+ `queryOrder` 已返回 PAID。

#### 1.4 退款服务（改 `src/server/services/order.service.ts`）

- 新增 `refund(orderId, userId, { reason, isAdmin })`，按 0.4.2 退款规则区分：
  - **自助退款**（非管理员）：校验「未下载（无 `Download` 记录）+ `paidAt` 在 24h 内 + `payStatus=PAID`」，不满足抛新错误码 `REFUND_NOT_ALLOWED`（402）。
  - **平台退款**（管理员）：任何 PAID 订单可退（侵权下架 / 内容严重不符 / 文件损坏 / 重复扣款）。
  - 事务：`Order.payStatus='REFUNDED', refundedAt` → 撤销下载权 `download.delete` → 冲减收益（未结算冲 `Wallet.pending`、已结算冲 `Wallet.balance`，`CreatorIncome.status='WITHDRAWN'`）→ 通知买家。
- 新增错误码 `REFUND_NOT_ALLOWED`（`errors.ts` + 前端 `errors.ts` 文案）。
- 路由：`POST /api/v1/orders/:id/refund`（owner 自助 / admin 平台）；管理端「订单退款」入口并入 V2-3 后台。

#### 1.5 前端收银台（改 `src/components/form/OrderModal.tsx` + 新增二维码组件）

- 依赖：新增 `qrcode`（`pnpm add qrcode`）生成二维码。
- `submit()` 后按 `pay.provider` 分支：
  - `mock` → 现逻辑（成功）。
  - `wechat` → 在 Modal 内渲染 `codeUrl` 的二维码 `<img>`（`qrcode.toDataURL(codeUrl)`），并启动订单轮询 `useOrder(orderId)`，`payStatus==='PAID'` 时弹「支付成功」。
  - `alipay` → `window.location.href = redirectUrl`，跳转后由回调返回（或轮询兜底）。
- 订单轮询已有 `useOrder`（每 2s），复用。

### 测试清单

- [ ] `pnpm typecheck` + `pnpm lint` 通过。
- [ ] 单测 `tests/unit/payment-crypto.test.ts` 扩充：用**自签证书**测 `wechatRequest` 的 Authorization 签名串格式、支付宝待签串拼接顺序（纯函数抽测）。
- [ ] 集成 `tests/integration/order.service.test.ts` 扩充：mock 退款（PAID→REFUNDED + 钱包冲减）、未支付退款报错。
- [ ] 冒烟：`PAYMENT_MODE=mock` 下前端收银台正常（mock 分支）；微信/支付宝分支在无密钥时抛「未配置」清晰报错（不崩溃）。

### 反思问题

- 支付回调验签失败如何排错？（答案须落在 `docs/PROGRESS.md`：日志记整笔 + 不 ack 让支付方重试）
- 退款与结算的时序如何保证钱包不出现负数？

---

## V2-2 性能优化

### 目标

解决压测暴露的 DB 连接池瓶颈；加 Redis 缓存与 views 异步计数；搜索加索引。

### 改动清单

#### 2.1 PgBouncer 连接池（改 `docker/docker-compose.yml` + `docker/docker-compose.prod.yml` + `.env.example`）

- 新增 `pgbouncer` 服务（`edoburu/pgbouncer`），`transaction` 模式，`MAX_CLIENT_CONN=200`，后端连 postgres。
- `.env.example` 加：
  - `DATABASE_URL_POOLED=postgresql://cm:cm@localhost:6433/campus_market`（应用连 pgbouncer，宿主端口 6433 避开 5432/5433）
  - Prisma `schema.prisma` datasource url 仍用 `DATABASE_URL`（迁移/直连），**运行时**应用连 `DATABASE_URL_POOLED`（见下）。
- `src/server/db.ts`：`new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL } } })`（生产走 pgbouncer，本地无 pooled 时回退直连）。

#### 2.2 Redis 缓存（改 `src/server/services/*.ts` + 新增 `src/server/lib/cache.ts`）

- 新增 `cache.ts`：`cacheGet<T>(key)` / `cacheSet(key, value, ttlSec)`（JSON 序列化 + Redis SET EX）。
- 缓存策略与失效：
  | 缓存项   | key                           | TTL | 失效时机                                                       |
  | -------- | ----------------------------- | --- | -------------------------------------------------------------- |
  | 作品列表 | `works:list:{serializeQuery}` | 30s | 作品 create/update/publish/audit 时 `DEL works:list:*`         |
  | 作品详情 | `work:detail:{id}`            | 60s | 该作品 update/评分/收藏/购买/浏览回写时 `DEL work:detail:{id}` |
  | 排行榜   | `rank:{type}`                 | 1h  | `rank-refresh` 定时任务重算覆盖                                |
- `work.service.list`：先 `cacheGet`，命中直接返回；未命中查 DB → `cacheSet`。
- `work.service.get`：同理（注意：views 计数移出（见 2.3），详情缓存不影响浏览计数）。
- `rank.service.ranks`：改先读 `rank:{type}`，未命中计算 → `cacheSet`。`rank-refresh` 任务调用 `ranks` 预热（见 V2-7 的 scheduler 已有该任务名）。

#### 2.3 views 异步计数（改 `src/server/services/work.service.ts` + `src/server/jobs/scheduler.ts`）

- `get()` 去掉同步 `prisma.work.update(views+1)`，改为 `redis.incr('view:'+workId)`。
- scheduler 新增 `view-sync` 任务（每 5 分钟）：扫描 `view:*` keys → 批量 `work.updateMany` 或逐条 `increment` 回写 DB → `DEL` 该 key。
- 详情缓存 key 失效与 view 回写解耦：回写 DB 时顺带 `DEL work:detail:{id}`。

#### 2.4 搜索 pg_trgm 索引（新增迁移 + 改 `src/server/services/search.service.ts`）

- 新增 Prisma migration：`CREATE EXTENSION IF NOT EXISTS pg_trgm;` + `CREATE INDEX ... ON works USING gin (title gin_trgm_ops);`（对 `description`、`course` 同）。
- `search.service.search`：`contains` 保持（数据量小可命中索引），无需改查询结构；`mode:'insensitive'` 已就位。

### 测试清单

- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test` 全绿。
- [ ] 集成：缓存命中/失效（改作品后详情缓存失效）；`view-sync` 回写后 `views` 正确累加。
- [ ] 压测复跑 `scripts/loadtest.sh`：列表 200 并发 p99 < 500ms、0 超时、吞吐较 V1 提升 ≥2×。
- [ ] `docker compose` 起 pgbouncer healthy；应用连 pooled 串跑通列表/详情。

### 反思问题

- Redis 缓存失效的「键粒度」是否会导致脏读？（答案：写操作只 DEL 相关 key，读操作 set，窗口期最多 30s 旧数据，可接受）
- views 异步回写丢失窗口（进程崩溃）最多丢多少？

---

## V2-3 管理后台完善 + 用户管理 + 数据看板

### 目标

补全 admin 三个缺失模块的前端 + 用户管理后端 + 数据看板。

### 改动清单

#### 3.1 用户管理后端（新增 `src/server/services/admin.service.ts` 方法 + 路由）

- 新增 `adminService.listUsers({ page, pageSize, q, role, status })`：`prisma.user.findMany`，`q` 匹配 username/email，返回脱敏列表（**不含 passwordHash**）。
- 新增 `adminService.banUser(userId, reason)`：`status='BANNED', bannedAt, bannedReason`（事务）；`unbanUser(userId)`：`status='ACTIVE'`。
- 新增 `adminService.setRole(userId, role)`：改 `role`（STUDENT/CREATOR/ADMIN）。
- 路由：
  - `GET /api/v1/admin/users`（分页+筛选，ADMIN）
  - `POST /api/v1/admin/users/[id]/ban`（body `{ reason }`）
  - `POST /api/v1/admin/users/[id]/unban`
  - `POST /api/v1/admin/users/[id]/role`（body `{ role }`）

#### 3.2 admin 前端四个 Tab（改 `src/app/(site)/admin/page.tsx`）

- Tab 从 2 个扩到 5 个：**待审核作品 / 举报队列 / 提现审批 / 创作者认证 / 用户管理**。
- 提现审批：`GET /admin/payouts`（**需补后端列表端点**，见下）+ `POST /admin/payouts/[id]`（complete/reject，后端已有）。
- 创作者认证：`GET /admin/creators/pending`（**需补后端列表端点**，列出 `verified=false` 的申请）+ `POST /admin/creators/[id]/audit`（后端已有）。
- 用户管理：表格（用户名/邮箱/角色/状态）+ 操作（封号弹窗填原因 / 解封 / 改角色下拉）。
- 复用 `useAuth` 权限守卫（V1 已加）。

#### 3.3 补两个列表端点（改 `src/server/services/admin.service.ts` + 路由）

- `GET /api/v1/admin/payouts`：`prisma.payout.findMany`（REQUESTED 优先，含 creator 用户名）。
- `GET /api/v1/admin/creators/pending`：`creatorProfile.findMany({ where:{verified:false}, include:{user} })`。

#### 3.4 数据看板（改 admin 页顶部 + 后端）

- `GET /api/v1/admin/stats`：返回 `{ users, works, orders, revenue, pendingWorks, pendingPayouts }`（各自 count/aggregate）。
- 前端顶部渲染 6 个 `stat-card`。

### 测试清单

- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test` 全绿。
- [ ] 集成 `admin.service`：封号后登录 `FORBIDDEN`（复用 B2 用例）；改角色生效；用户列表脱敏（无 passwordHash）。
- [ ] 冒烟：admin 五个 Tab 均能加载数据并操作。

### 反思问题

- 封号后用户已有的 JWT 会话如何处理？（答案：JWT 无状态，需在 `requireUser` 增加 DB 状态校验，或接受 7 天内过期——本阶段改为 `requireUser` 查 `status==='ACTIVE'`）

---

## V2-4 安全加固

### 目标

补 BACKEND.md §6.5 欠账：CSRF、XSS、限流补全。

### 改动清单

#### 4.1 CSRF（改 `src/server/lib/http.ts` + 各写操作路由）

- `withErrorHandler` 内对**非 GET/HEAD** 请求校验 `Origin`/`Referer` 与 `APP_BASE_URL` 同源；不符抛 `FORBIDDEN`。webhook 路由跳过（走验签）。
- 实现为独立 helper `assertSameOrigin(req)`，在 `readJson` 前调用（写操作）。

#### 4.2 XSS（改 `src/server/services/rating.service.ts`、`social.service.ts` 等写入口）

- 引入 `sanitize-html`（依赖已在 package.json）：对用户输入的富文本字段（评价 text、评论 content、用户名、通知 text 里的 `<b>`）做白名单清洗：允许 `['b','strong','i','em','br']`，其余标签/属性剥离。
- 封装 `sanitize(html)` 在 `src/server/lib/sanitize.ts`，所有 `create/update` 写文本前调用。
- 前端通知渲染已用 `dangerouslySetInnerHTML`，服务端清洗后安全。

#### 4.3 限流补全（改 `src/server/services/upload.service.ts`、`report.service.ts`）

- 上传 presign：每用户 10/小时（`enforceRateLimit('rl:upload:'+userId, 10, 3600_000)`）。
- 举报：每用户 5/小时。

### 测试清单

- [ ] 单测 `sanitize`：`<script>` 被剥离、`<b>` 保留。
- [ ] 集成：跨源 Origin 写操作 → 403；上传/举报超限 → 429。
- [ ] `pnpm test` 全绿。

### 反思问题

- sanitize 白名单是否覆盖了所有用户输入点？

---

## V2-5 功能补全（评论 / 通知 / 成就 / 原创保护）

### 目标

补数据模型已建但逻辑未落地的能力 + 原创保护（防重复上架）。

### 改动清单

#### 5.1 评论（新增 `src/server/services/comment.service.ts` + 路由 + 前端）

- `commentService.list(workId, page)` / `create(userId, workId, { content, parentId? })` / `remove(commentId, userId)`（软删 `deletedAt`，owner/admin）。
- 路由：`GET /api/v1/works/[id]/comments`、`POST /api/v1/works/[id]/comments`、`DELETE /api/v1/comments/[id]`。
- `create` 先 `sanitize(content)`；内容 `content` 已 `@db.VarChar(600)`。
- 前端：详情页评价区下方加「评论」区块（复用 `ReviewItem` 样式或新增 `CommentItem`）。

#### 5.2 通知中心（改 `src/app/(site)/me/page.tsx`）

- 「通知」Tab 顶部加「全部已读」按钮 → `POST /me/notifications/read-all`（后端已有）；未读项高亮（`n.read` 驱动）。

#### 5.3 成就触发（改对应 service）

- 在评分 `ratingService.create`：首个五星（`FIRST_FIVE_STAR`，作者无五星作品时触发）。
- 在购买 `orderService.markPaid`：首次收益（`FIRST_INCOME`，创作者首次 creatorIncome 时触发）。
- 在下载/购买累计帮助：`HELP_50`/`HELP_1000`（创作者 helped 达到阈值时触发）。
- 统一封装 `achievementService.grant(userId, key)`（幂等：`user_achievements` 唯一约束兜底 + 查重）。
- 前端：创作者中心「成就墙」（`GET /me/achievements` 返回已获成就 + 字典）。

#### 5.4 原创保护与文件去重（改 schema + upload + 前端）

- `prisma/schema.prisma`：`Work` 加 `isOriginal Boolean @default(true)` + 新迁移；`fileSha` 字段 V1 已建（`String?`），本阶段真正启用。
- `upload.service.presign` 输入已有 `sha` 字段：校验若 `work.findFirst({ where:{ fileSha:sha, deletedAt:null } })` 存在 → 抛 `CONFLICT`「该文件已在平台」。
- 前端 `/upload`：用 `crypto.subtle.digest('SHA-256', file)` 计算哈希 → 传给 presign + createWork；新增「原创 / 整理 / 转载」单选 → 映射 `isOriginal`。
- 前端展示：作品卡 `WorkCard` / 详情页标题旁「原创」徽标（`isOriginal` 驱动）。
- 测试：重复 `fileSha` 拒绝上架（CONFLICT）；`isOriginal` 默认 true。

### 测试清单

- [ ] 集成：评论 CRUD + 权限（非作者删除 403）+ sanitize；成就幂等（重复触发只一次）；通知 read-all；**重复 fileSha 拒绝 + 原创徽标字段**。
- [ ] `pnpm test` 全绿。

### 反思问题

- 成就阈值触发放在 service 事务内还是事务后？（答案：事务后异步/同步幂等 grant，避免拉长事务）

---

## V2-6 测试与 CI

### 目标

补 E2E 7 条路径、覆盖率达标、GitHub Actions CI。

### 改动清单

#### 6.1 Playwright E2E（新增 `e2e/*.spec.ts` + 配置）

- `playwright.config.ts`：`baseURL http://localhost:3000`，`PAYMENT_MODE=mock`，测试库种子。
- 7 条核心路径（BACKEND.md §12.4）：
  1. 注册→登录→首页→点作品→购买(mock)→下载→评分→评价出现
  2. 关注创作者→动态流出现新作品
  3. 创作者发布→审核通过→我的资料出现
  4. 收藏→首页卡片态→我的收藏
  5. 举报→管理员处理
  6. 收益明细+提现→管理员完成
  7. 搜索→筛选→详情
- 脚本：`pnpm test:e2e`（前置起 dev/test 环境）。

#### 6.2 覆盖率（改 `vitest.config.ts`）

- 确认 coverage include 覆盖 `server/services`、`server/algos`、`server/lib`、`lib/zod`；阈值单测 90%/集成 85%（已在 V1 配置，本阶段补测试使达标）。

#### 6.3 GitHub Actions（新增 `.github/workflows/ci.yml`）

- job：`pnpm install` → `docker compose up -d postgres redis` → `prisma migrate deploy`（对测试库）→ `lint` + `typecheck` + `test`。
- 触发：push + PR。

### 测试清单

- [ ] `pnpm test:e2e` 7 条全绿。
- [ ] `pnpm test:cov` 单测≥90%、集成≥85%。
- [ ] CI 在 GitHub 上绿。

### 反思问题

- E2E 的测试库隔离如何保证不污染 dev 数据？（答案：E2E 用独立 `campus_market_e2e` 库 + 种子）

---

## V2-7 可观测与部署

### 目标

加结构化访问日志 + requestId；Sentry 可选；生产部署脚本 + 文档收尾。

### 改动清单

#### 7.1 请求日志（改 `src/middleware.ts` 或 route 层 + 新增 `requestId`）

- 引入 `pino-http`：`middleware.ts` 注入 `requestId`（或复用 `crypto.randomUUID`），写访问日志（method/path/status/duration）。
- 敏感字段脱敏沿用 `logger.ts` redact。

#### 7.2 Sentry（可选，改 `instrumentation` / `src/app/layout.tsx`）

- 有 `SENTRY_DSN` 时初始化 `@sentry/nextjs`，否则跳过（V1 已装依赖，未接入）。

#### 7.3 部署脚本 + 文档（新增 `scripts/deploy.sh` + 改 `docs/DEPLOY.md`）

- `scripts/deploy.sh`：`git pull → pnpm install → prisma migrate deploy → pnpm build → docker compose -f docker-compose.prod.yml up -d --build`。
- `docs/DEPLOY.md` 更新：PgBouncer 端口、`DATABASE_URL_POOLED`、真实支付上线（微信/支付宝下单代码已就绪，只需密钥）。

### 测试清单

- [ ] 冒烟：请求日志含 requestId + duration。
- [ ] `scripts/deploy.sh` 在测试服务器跑通。

### 反思问题

- 日志量在高并发下如何控制？（答案：pino-http 采样或按状态码分级）

---

## 附：关键技术骨架

### 微信 v3 签名（复用 `crypto.ts`）

```ts
import { rsaSign } from './crypto';
function authHeader(
  method: string,
  path: string,
  body: string,
  mchid: string,
  serial: string,
  privateKey: string,
): string {
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = randomUUID();
  const message = `${method}\n${path}\n${ts}\n${nonce}\n${body}\n`;
  const sig = rsaSign(message, privateKey);
  return `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce}",timestamp="${ts}",serial_no="${serial}",signature="${sig}"`;
}
```

### Redis 缓存封装（`src/server/lib/cache.ts`）

```ts
export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}
export async function cacheSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSec);
}
```

### 用户管理脱敏

```ts
// adminService.listUsers 返回项严禁包含 passwordHash/passwordPepper
const SAFE_SELECT = {
  id: true,
  username: true,
  email: true,
  role: true,
  status: true,
  avatarColor: true,
  createdAt: true,
  lastLoginAt: true,
};
```

---

## 文档完 — 执行守则再提醒

按阶段推进、测试全绿、写 PROGRESS、不省细节。完成全部 7 阶段后，版本二即满足「生产级、可收真实钱、扛得住并发、后台完备」的目标。
