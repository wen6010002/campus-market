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
- ✅ `docker compose up -d` 三服务 healthy（postgres/redis/minio 均 healthy，`createbuckets` 自动建桶 `campus-market`）

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

---

## 阶段 0 — 前端脚手架（F0）

**做了什么**

- `src/styles/globals.css`：原型 `assets/style.css`（743 行）**整体复制** + 末尾追加 next/font 注入块，设计 token/组件类零改动。
- 字体：`next/font/google` 自托管 Plus Jakarta Sans + Noto Sans SC，注入 `--font-jakarta`/`--font-noto`，覆盖原型 Google Fonts `<link>`。
- 路由结构：根 `layout.tsx`(html/body/字体/Providers) + `(site)/layout.tsx`(Nav+Footer) + `(site)/page.tsx`(占位首页)。
- 前端基建：`lib/api/client.ts`(apiFetch/ApiError/uploadFile 直传)、`lib/api/errors.ts`(错误码→文案)、`lib/format.ts`(formatCny/formatNum/timeAgo)、`lib/icons.tsx`(原型 ICONS 提取 + Star)、`lib/types.ts`(契约 §3 共享类型，待 zod 落地后切换)。
- 组件：`chrome/Nav.tsx`、`chrome/Footer.tsx`（严格还原原型 navHTML/footHTML，含登录/未登录态、未读红点、dropdown）；`common/`(Modal/ModalHead/ModalBody/ModalFoot、Toast、Stars、Stepper、Empty、Tabs、StatCard、Tag/Chip)。
- 状态：`stores/ui.ts`(Zustand toast)、`app/providers.tsx`(QueryClient + ToastHost)、`hooks/useAuth.ts`(401→null 的登录态 hook，F1 完善)。
- 目录按 `FRONTEND.md §2.2` 建好。

**测试清单结果**

- ✅ `pnpm typecheck` 通过
- ✅ `pnpm lint` 通过（0 警告 0 错误）
- ✅ `pnpm test` 通过（3/3）
- ✅ `pnpm dev` 首页 200，next/font 自托管字体变量注入成功（HTML 含 `__variable_*`）

**遇到的问题**

1. **`.next` 缓存残留旧类型**：删除根 `page.tsx` 移入 `(site)/` 后，`.next/types/app/page.ts` 仍指向旧路径导致 typecheck 报 `TS2307`。已 `rm -rf .next` 解决。
2. **根 page 与 (site) 路由冲突**：`src/app/page.tsx` 与 `src/app/(site)/page.tsx` 映射同一 URL `/`，两者并存会报错。已删除根 `page.tsx`。

**反思（阶段 0 命题：布局/字体是否与原型像素级一致？）**

- 样式整体复制保证 token 一致；next/font 自托管避免外网依赖且验证可加载。Nav 在「未登录」态额外增加登录/注册按钮（原型恒为已登录态），这是真实应用的必要扩展，不破坏视觉。

**下阶段是否受影响**

- `lib/types.ts` 是临时类型源，B1/B2 落地 zod 后需把 `import type` 切换到 `@/lib/zod/*` 的 `z.infer`，字段名已按契约对齐，切换成本低。

---

## 阶段 1 — 数据模型（B1）

**做了什么**

- `prisma/schema.prisma`：全量 model + enum（User/StudentProfile/CreatorProfile/Work/Tag/WorkTag/WorkRating/RatingTag/WorkRatingTag/Comment/Order/Download/Follow/Favorite/Like/Dynamic/Wallet/CreatorIncome/Payout/Notification/Report/AuditLog/Achievement/UserAchievement/VerificationToken），金额 Decimal、计数冗余、软删除、唯一约束、索引齐全。
- 迁移 `20260813070228_init` 已生成并应用到 dev 库。
- `src/server/db.ts`：Prisma 单例。
- `prisma/seed.ts`：生产种子（6 成就 + 10 评分标签 + 6 用户[5 创作者+演示用户温昊璇] + 20 作品 + 33 标签 + 演示用户社交态[关注/收藏/下载/订单/收益流水/通知]），幂等 upsert，数据沿用原型 app.js。
- `prisma/seed.test.ts` + `tests/helpers/flush.ts` + `tests/integration/schema.test.ts`：测试种子 + 清表 + 行数/唯一约束测试。
- 测试库 `campus_market_test` 已建并同步 schema。

**测试清单结果**

- ✅ `prisma generate` 通过（49 校验错误 → 修复后 0）
- ✅ `prisma migrate dev --name init` 迁移应用成功
- ✅ `pnpm db:seed` 完成（6 用户 / 20 作品 / 6 成就 / 10 标签 / 33 tags）
- ✅ `pnpm typecheck` 通过
- ✅ `pnpm lint` 通过
- ✅ `pnpm test` 通过（7/7：3 单测 + 4 集成；重复关注/评分/用户名均触发 P2002）

**遇到的问题**

1. **Prisma 枚举必须多行**：文档 §5.2 用单行简写（`enum Role { STUDENT CREATOR ADMIN }`），真实 Prisma 语法需每值一行。已全部展开。
2. **本机 Homebrew PostgreSQL 占用 5432**：`localhost:5432` 被本机 PG(16.9) 抢占，Prisma 连到了非 docker 的库报 P1010「denied access」。已将 docker 宿主端口改为 **5433**（`5433:5432`），`.env`/`.env.example`/compose 注释同步。
3. **文档 schema 的几处自身矛盾**（已按意图修正，非改表设计）：
   - `Work` 同时有 `likes Int`(计数) 与 `likes Like[]`(关系) 重名 → 关系改名 `likes_rel Like[]`（与 `downloads_rel` 一致）。
   - `Report.works Work[]`/`Work.reports Report[]` 试图用关系建模多态 target（WORK/COMMENT/USER）→ 移除，保留 `targetType+targetId` 字符串，反查走查询。
   - `Payout` 同时外键到 `CreatorProfile` 与 `User` → 只保留 `CreatorProfile`（与 Wallet/CreatorIncome 一致），移除 `User.payouts`。
   - `Dynamic.creator` 是 `User` 关系，但文档写在 `CreatorProfile.dynamics` → 移到 `User.dynamics`。
   - `Account/Session`（JWT 策略下 DB adapter 可省）→ 省略，保留 `VerificationToken`。
4. **`CreatorIncome.creatorId` 引用 `CreatorProfile.id` 而非用户 id**：种子首跑报 P2003。已先解析 `creatorProfile` 再建订单收益。这也提醒 B7 收益服务需统一「userId → creatorProfile.id」解析。

**反思（阶段 1 命题：计数冗余是否齐全？索引是否覆盖列表查询？）**

- 计数冗余：`rating/ratingCount/ratingDist/downloads/favs/likes/views` 均落 `Work` 字段（事务维护），符合「避免高频聚合」。
- 索引：`Work(status,quality,publishedAt)`、`Work(authorId,status)`、`Work(course)`、`WorkRating(workId,createdAt)`、`Order(workId,payStatus)`/`Order(buyerId,createdAt)`、`Follow(followingId)`、`Notification(userId,read,createdAt)` 覆盖主要列表/详情/动态查询；`creator_incomes(status,settleAt)` 覆盖结算任务扫描。搜索（title/desc 模糊）留待 B8 加 `pg_trgm`。

**下阶段是否受影响**

- B2 鉴权需「userId → creatorProfile.id」解析能力，且种子用户当前是占位密码 hash（不可登录），B2 需为演示用户补真实 bcrypt hash（或独立 dev 登录入口）。

---

## 阶段 2 — 鉴权（B2）

**做了什么**

- **鉴权方案决策**：未采用 Auth.js v5 runtime。Auth.js v5 beta 在 Next 14 App Router 下（credentials provider + 自定义 `/api/v1/auth/*` 端点 + RSC session 注入）摩擦大，且契约暴露的是自定义端点而非 Auth.js 端点。按文档授权回退，用 **`jose` 自研 JWT 会话**（httpOnly cookie `cm_token`、SameSite=Lax、生产 Secure、HS256、载荷 `{userId, role, creatorProfileId}`），完全对齐契约。移除 `next-auth`/`@auth/core`（死依赖）。
- `server/lib/*`：`errors.ts`(ErrorCode 全量 + AppError + httpStatus 映射)、`redis.ts`(ioredis 单例)、`ratelimit.ts`(Redis 原子 Lua 滑动窗口)、`mailer.ts`(nodemailer + mailhog)、`logger.ts`(pino 脱敏)、`http.ts`(withErrorHandler/ok/okPage/readJson)。
- `server/auth/*`：`password.ts`(bcrypt cost=12 + pepper)、`verify-code.ts`(Redis 6 位码 TTL10min + edu 正则)、`session.ts`(jose sign/verify + getSession/requireUser/requireCreator/requireAdmin)、`rbac.ts`(权限矩阵)。
- `lib/zod/common.ts` + `lib/zod/auth.ts`：分页/排序/枚举 + 鉴权请求响应 schema（即契约）。
- `services/auth.service.ts`：sendCode(防枚举)/register/login(防枚举统一文案+封号拦截)/applyCreator/buildAuthUser。
- 路由：`/api/v1/auth/{send-code,register,login,logout,me}` + `/api/v1/me/creator/apply`。
- `middleware.ts`：`/api/v1` 粗粒度首道防线（公开路由放行，其余无 cookie → 401）。
- 种子：演示账号 `demo@szu.edu.cn` / `demo1234`（真实 bcrypt hash，供联调/E2E）。

**测试清单结果**

- ✅ `pnpm typecheck` 通过
- ✅ `pnpm lint` 通过
- ✅ `pnpm test` 通过（25/25：3 单测文件 + 2 集成文件）
- ✅ `pnpm dev` 冒烟：登录 demo 账号返回 AuthUser + set-cookie，`me` 带 cookie 成功、无 cookie 401，非 edu 邮箱 send-code 返回 NOT_EDU

**遇到的问题**

1. **Auth.js v5 弃用**：见上「鉴权方案决策」。`next/headers` 的 `cookies()` 只在请求上下文可用，故 session.ts 里 `signSession/verifySession`（纯 JWT）与 `getSession`（读 cookie）同文件，但单元测试只 import 前者，无 Next 上下文问题。
2. **种子 `passwordPepper` 残留**：首版种子给用户写了 `passwordPepper:'seed'`，登录按 per-user pepper 校验导致与全局 pepper 哈希不匹配（INVALID_CREDENTIAL）。已把 `update` 子句补 `passwordPepper:null` + email 更新，重跑种子修复。
3. **edu 正则只支持一级子域名**：契约 `^[^@]+@([a-zA-Z0-9-]+\.)?edu\.cn$` 匹配 `x@szu.edu.cn` 但不匹配 `x@cs.tsinghua.edu.cn`（两级）。按契约原样实现，测试预期已对齐。

**反思（阶段 2 命题：JWT 续期策略是否会并发丢会话？）**

- 当前会话固定 7 天、无滑动续期。并发请求同时触发续期不会丢会话（JWT 是无状态签名，写 cookie 是幂等的「覆盖写」，不存在读-改-写竞态）；但会多一次重签。**结论：不丢会话，只是冗余重签**。滑动续期（剩余 <1/3 时重签）留待 B10 统一实现。

**下阶段是否受影响**

- B3 作品依赖 `requireCreator()`（已就绪）与「userId → creatorProfile.id」解析（`requireCreator` 已返回 `creatorProfileId`）。上传 presign 的权限走 `hasPermission(role,'upload')` + `requireCreator`。

---

## 阶段 1 — 鉴权页（F1）

**做了什么**

- `/login`：教育邮箱 + 密码 → `POST /auth/login` → 失效 `['me']` → 跳回 `?from=`（默认 `/`）。
- `/register`：edu 邮箱 + 发送验证码（60s 倒计时 + NOT_EDU/RATE_LIMITED 文案）→ 验证码 + 用户名 + 密码 + 学校/学院/专业/年级 → `POST /auth/register` → 跳回。
- `hooks/useAuth.ts` 扩展：`useLogout()`（POST /auth/logout + 清 `['me']` + 跳首页）。
- Nav「退出登录」接通 useLogout。
- 表单复用原型 `.field/.input/.input-group/.card/.btn` 类，视觉与设计 token 一致（鉴权页为原型新增页）。

**测试清单结果**

- ✅ `pnpm typecheck` 通过
- ✅ `pnpm lint` 通过
- ✅ `pnpm dev` 冒烟：`/login`、`/register` 均 200，表单字段齐全

**遇到的问题**

- `useSearchParams` 在 Next 14 静态页需 Suspense 包裹，改用 `window.location.search` 读 `from` 参数，避免额外 Suspense 包装。

**下阶段是否受影响**

- 无。F2 作品列表/详情直接复用 `apiFetch`/`useAuth`/common 组件。

---

## 阶段 3 — 作品（B3）

**做了什么**

- `server/storage/minio.ts`：S3 兼容客户端 + presignPut/presignGet/headObject（MinIO）。
- `services/upload.service.ts`：presign（类型白名单 + 200MB 上限 + `works/{userId}/{uuid}.{ext}` 生成 fileKey）。
- `lib/zod/work.ts`：`WorkInput`（title/desc/course/fileType/fileKey/fileSize/tags≤5/previewToc/copyrightAccepted + 金额字符串正则）+ `WorkQuery`（分页/过滤/排序 complex|hot|rate|new|price）。
- `services/work.service.ts`：list(仅 PUBLISHED + 过滤/排序)、get(浏览+1 + myFav/myAccess/myRating/author 聚合)、create(DRAFT + 版权强制)、update(owner + 仅 DRAFT/REJECTED)、publish(headObject 校验 + PENDING)、remove(软删)、related(同作者/同标签)、adminPending、adminAudit(状态机 + AuditLog)。
- 路由：`/works`(GET/POST)、`/works/[id]`(GET/PUT/DELETE)、`/works/[id]/publish`、`/works/[id]/related`、`/uploads/presign`、`/admin/works/pending`、`/admin/works/[id]/audit`。
- 测试：`upload.service.test.ts`(类型/大小校验) + `work.service.test.ts`(版权/CRUD 权限/状态机/列表/浏览计数)，mock MinIO。

**测试清单结果**

- ✅ `pnpm typecheck` 通过
- ✅ `pnpm lint` 通过
- ✅ `pnpm test` 通过（36/36：6 文件）
- ✅ `pnpm dev` 冒烟：`GET /works`(分页/过滤/排序 + 金额字符串/评分 1 位小数)、`GET /works/:id`(详情 + 聚合 author)

**遇到的问题**

1. **`Request` 类型无 `nextUrl`**：`withErrorHandler` 用原生 `Request`，`req.nextUrl` 是 Next 的 `NextRequest` 专有属性。改用 `new URL(req.url).searchParams`。
2. **`AuditLog.reviewerId` FK 需有效用户**：测试早期传了不存在的 `admin_x` 触发 P2003。审核服务层不校验角色（角色在 `requireAdmin` 路由层校验），reviewerId 只需有效 User id。
3. **`WORK_LIST_INCLUDE` 需含 student**：author 聚合里的 `college/major` 来自 StudentProfile，`as const` 冻结后 include 里漏了 `student:true` 导致 TS 报 `student` 不存在。

**反思（阶段 3 命题：列表复合排序 SQL 是否走索引？）**

- `Work(status,quality,publishedAt)` 联合索引覆盖「status 过滤 + quality 排序 + publishedAt 排序」的 complex/new 排序；`Work(course)` 覆盖 course 过滤。但 `downloads/rating` 排序（hot/rate）无索引（非选择性列，PG 不会用索引排序，走 seq scan + sort 对小到中量数据可接受；大表可加 `(status,downloads desc)` 部分索引）。搜索模糊 `contains` 未走索引，留待 B8 加 `pg_trgm`。

**下阶段是否受影响**

- B4 交易依赖 `Work` 的 `isFree/price/status` 与「hasAccess」判断（Download/Order），B3 已把 myAccess 逻辑在详情里实现，B4 复用。B5 评分复用 `WORK_LIST_INCLUDE` 与聚合模式。
