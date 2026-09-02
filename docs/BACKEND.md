# Campus Market — 后端开发文档

> **给 Claude Code 的执行守则（先读）**
>
> 1. 严格按本文档的目录结构、命名、版本、字段实施，不要擅自换技术栈或重命名表/字段。
> 2. 每个阶段完成后**必须**跑该阶段的测试清单，全绿后再进入下一阶段；每阶段末回答「反思问题」并写入 `docs/PROGRESS.md`。
> 3. 所有 API 输入/输出必须用 `src/lib/zod/*` 的 Zod schema 校验；schema 即契约，与 `API_CONTRACT.md` 保持一致。
> 4. 涉及钱（订单/收益/提现）、权限（评分/下载/审核）、外部回调（支付 webhook）的逻辑必须**事务 + 幂等键**。
> 5. 不要 mock 掉鉴权去“方便测试”——用工厂函数造真实用户会话。
> 6. 任何“TODO/暂略”都视为未完成；本文档不存在可省略的细节。
> 7. 原型（真相参考）在 `../campus-market-v3/*.html` + `assets/app.js`，所有字段/状态/文案以后端本文档为准，但**交互与视觉以前端原型为准**。

---

## 1. 项目总览

### 1.1 产品定位

Campus Market = **大学生成长社区 + 校园知识内容市场**（参考 B 站 UP 主生态）：学生既是消费者也可成为创作者；可浏览/免费下载/购买精品/关注/收藏/评分（仅购买或下载者可评）/上传；创作者通过免费作品积累影响力、通过精品获得收益、长期沉淀个人品牌。

### 1.2 核心飞轮（后端要支撑的闭环）

```
上传 → 平台完善(审核/AI 辅助) → 免费曝光 / 精品付费
→ 收藏 / 关注 / 下载 / 购买 → 评分(仅购买者) → 高质量作品获更高排名
→ 创作者影响力↑ + 收益↑(平台抽成 10%) → 提现 → 持续上传
```

### 1.3 生产级硬性要求（验收清单）

- [ ] 鉴权：edu 邮箱验证码注册、JWT(httpOnly cookie)、RBAC(student/creator/admin)、路由级中间件、登录/验证码/支付限流。
- [ ] 交易：订单→支付(微信 v3/支付宝,含 mock)→异步回调(验签+幂等+事务)→下载权限→收益流水→通知。
- [ ] 评分：资格校验 + 事务重算均值/分布；每人每作品一次。
- [ ] 收益：T+7 结算定时任务、钱包、提现申请/审核/到账。
- [ ] 治理：作品审核状态机、举报、版权声明强制、审计日志。
- [ ] 文件：MinIO presigned 直传、大小/类型白名单。
- [ ] 非功能：结构化日志、限流、Sentry、备份、CI/CD、健康检查。
- [ ] 测试：单元 ≥90% / 集成 ≥85% / E2E 覆盖 7 条核心路径。

### 1.4 与原型的对照（字段来源）

| 原型（app.js）                                                                                    | 后端落点                                                                                                       |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `CREATORS[]`(helped/fans/rate/works/income/dynamics/achievements)                                 | `User`+`CreatorProfile`+`Dynamic`+`Achievement`；helped/fans/rate/works 由聚合查询，不存储                     |
| `WORKS[]`(rating/ratingCount/ratingDist/downloads/favs/likes/views/quality/apply/preview/ratings) | `Work`(rating/ratingCount/ratingDist 落字段，事务维护；downloads/favs/likes/views 落字段冗余计数)+`WorkRating` |
| `CURRENT_USER.income/incomeList/withdrawList`                                                     | `Wallet`+`CreatorIncome`+`Payout`                                                                              |
| `Store`(follows/favs/orders/downloads/myRatings/uploads/notifications/reports/withdrawn)          | `Follow/Favorite/Order/Download/WorkRating/Work(upload)/Notification/Report/Payout`                            |

---

## 2. 技术栈与版本（固定）

| 分类        | 选型                                                       | 版本                        | 理由                             |
| ----------- | ---------------------------------------------------------- | --------------------------- | -------------------------------- |
| 框架        | next                                                       | 14.2.x (App Router)         | 全栈单项目，RSC + Route Handlers |
| 语言        | typescript                                                 | 5.4.x (strict)              | 类型安全                         |
| 包管理      | pnpm                                                       | 9.x                         | 速度快、磁盘省                   |
| ORM         | prisma + @prisma/client                                    | 5.18.x                      | 类型安全迁移                     |
| 数据库      | postgres                                                   | 16-alpine                   | 关系型主库                       |
| 缓存/队列   | redis + ioredis + bullmq                                   | 7-alpine / 5.4 / 5.x        | 限流/缓存/定时任务               |
| 鉴权        | next-auth(@auth/core)                                      | v5 beta                     | JWT 策略 + cookie                |
| 密码        | bcryptjs                                                   | 2.4.3                       | 哈希                             |
| 校验        | zod                                                        | 3.23.x                      | schema 即契约                    |
| 邮件        | nodemailer                                                 | 6.9.x                       | SMTP 验证码                      |
| 存储        | minio + @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner | latest                      | S3 兼容 presigned 直传           |
| 支付-微信   | wechatpay-axios-plugin 或自封 v3                           | —                           | Native/H5/JSAPI                  |
| 支付-支付宝 | alipay-sdk                                                 | 4.x                         | 电脑/手机网站                    |
| 限流        | @upstash/ratelimit(用自建 Redis 适配)                      | 2.x                         | 滑窗                             |
| 日志        | pino + pino-http                                           | 9.x                         | 结构化                           |
| 错误监控    | @sentry/nextjs                                             | 8.x                         | 可选但推荐                       |
| 测试        | vitest + @testing-library + supertest + msw + playwright   | 1.6 / 0.16 / 7 / 2.x / 1.46 | 分层                             |
| 代码质量    | eslint + prettier + husky + lint-staged + commitlint       | 8.57 / 3.3 / 9 / 15 / 19    | 规范                             |
| CI          | GitHub Actions                                             | —                           | lint/test/build/deploy           |
| 部署        | docker compose                                             | —                           | dev/prod 一致                    |

> 替代项说明：Auth.js v5 仍 beta 但生态主推；若需更稳可用 NextAuth v4（API 不变）。支付若只跑 mock 可不装 SDK，但文档要求完整对接。

---

## 3. 项目结构（严格遵循）

```
campus-market/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   ├── seed.ts                      # 生产 seed（学校/学院/标签/示例创作者）
│   └── seed.test.ts                 # 测试 seed
├── src/
│   ├── app/
│   │   ├── (site)/                  # 前端页面路由（仿原型，见 FRONTEND.md）
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── auth/[…nextauth]/route.ts
│   │   │       ├── works/route.ts
│   │   │       ├── works/[id]/route.ts
│   │   │       ├── works/[id]/ratings/route.ts
│   │   │       ├── works/[id]/order/route.ts
│   │   │       ├── works/[id]/download/route.ts
│   │   │       ├── orders/[id]/pay/route.ts
│   │   │       ├── webhooks/pay/{wechat,alipay}/route.ts
│   │   │       ├── uploads/presign/route.ts
│   │   │       ├── creators/[id]/route.ts
│   │   │       ├── me/…/route.ts
│   │   │       ├── search/route.ts
│   │   │       ├── ranks/[type]/route.ts
│   │   │       ├── notifications/route.ts
│   │   │       ├── reports/route.ts
│   │   │       └── admin/…/route.ts
│   │   └── layout.tsx
│   ├── server/
│   │   ├── db.ts                    # Prisma client 单例
│   │   ├── auth/
│   │   │   ├── config.ts            # Auth.js 配置
│   │   │   ├── options.ts
│   │   │   ├── session.ts           # getSession/requireUser/requireAdmin
│   │   │   ├── verify-code.ts       # edu 邮箱验证码生成/校验(Redis)
│   │   │   └── rbac.ts              # 角色/权限矩阵
│   │   ├── services/                # 业务逻辑（路由薄层调用）
│   │   │   ├── auth.service.ts
│   │   │   ├── work.service.ts
│   │   │   ├── rating.service.ts
│   │   │   ├── order.service.ts
│   │   │   ├── payment.service.ts
│   │   │   ├── creator.service.ts
│   │   │   ├── income.service.ts
│   │   │   ├── social.service.ts   # 收藏/关注/点赞
│   │   │   ├── search.service.ts
│   │   │   ├── rank.service.ts
│   │   │   ├── notify.service.ts
│   │   │   ├── report.service.ts
│   │   │   ├── audit.service.ts
│   │   │   └── upload.service.ts
│   │   ├── payment/
│   │   │   ├── wechat.ts
│   │   │   ├── alipay.ts
│   │   │   ├── mock.ts
│   │   │   └── index.ts             # 按 PAYMENT_MODE 分发
│   │   ├── storage/minio.ts
│   │   ├── jobs/                    # BullMQ 定时任务
│   │   │   ├── income-settle.worker.ts
│   │   │   ├── rank-refresh.worker.ts
│   │   │   ├── order-timeout.worker.ts
│   │   │   ├── notification-cleanup.worker.ts
│   │   │   └── scheduler.ts
│   │   ├── algos/                   # 纯函数算法（单测重点）
│   │   │   ├── rating.ts            # 重算均值/分布
│   │   │   ├── income.ts            # 抽成/结算
│   │   │   ├── quality.ts           # 质量等级
│   │   │   └── rank.ts              # 排行榜
│   │   ├── lib/
│   │   │   ├── redis.ts
│   │   │   ├── ratelimit.ts
│   │   │   ├── mailer.ts
│   │   │   ├── logger.ts
│   │   │   ├── errors.ts            # AppError + 错误码枚举
│   │   │   └── idempotency.ts
│   │   └── middleware/rbac.ts
│   ├── lib/
│   │   ├── zod/                     # 共享 schema（前后端共用类型）
│   │   │   ├── common.ts            # 分页/排序/枚举
│   │   │   ├── auth.ts
│   │   │   ├── work.ts
│   │   │   ├── rating.ts
│   │   │   ├── order.ts
│   │   │   ├── creator.ts
│   │   │   └── ...
│   │   └── constants.ts             # 枚举字典（与 API_CONTRACT 一致）
│   └── middleware.ts                # Next.js 中间件（RBAC + 限流入口）
├── tests/
│   ├── setup.ts                     # 起 test DB、redis、minio testcard
│   ├── factories.ts                 # 实体工厂
│   ├── helpers/
│   │   ├── api.ts                   # 模拟登录会话调 API
│   │   └── flush.ts                 # 清表
│   ├── unit/
│   └── integration/
├── e2e/                             # Playwright
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml           # dev
│   └── docker-compose.prod.yml
├── .env.example
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
└── README.md
```

**分层约定**：`app/api/*/route.ts` 只做 **解析→鉴权→调 service→返回**，业务逻辑全在 `server/services/*`，纯算法在 `server/algos/*`。路由层禁止直接调 Prisma（便于测试与替换）。

---

## 4. 环境与启动

### 4.1 `.env.example`（全量，必填项标注 #required）

```env
# App
NODE_ENV=development
APP_BASE_URL=http://localhost:3000         #required 支付回调用

# Database
DATABASE_URL=postgresql://cm:cm@localhost:5432/campus_market  #required
DATABASE_URL_TEST=postgresql://cm:cm@localhost:5432/campus_market_test

# Redis
REDIS_URL=redis://localhost:6379            #required

# Auth
AUTH_SECRET=<openssl rand -base64 32>       #required
AUTH_TRUST_HOST=true
JWT_COOKIE_NAME=cm_token
PASSWORD_PEPPER=<random>                    #追加 pepper

# Mail (edu 验证码)
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=apikey
SMTP_PASS=...
MAIL_FROM="Campus Market <no-reply@cm.dev>"
VERIFY_CODE_TTL_MIN=10
VERIFY_CODE_LEN=6
EDU_EMAIL_REGEX=^[^@]+@([a-zA-Z0-9-]+\.)?edu\.cn$

# Storage (MinIO)
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=campus-market
S3_PUBLIC_BASE=http://localhost:9000         #签名下载用

# Payment
PAYMENT_MODE=mock                            #mock | wechat | alipay | all
WECHAT_APPID=                                #PAYMENT_MODE 含 wechat 时 required
WECHAT_MCHID=
WECHAT_API_V3_KEY=
WECHAT_SERIAL_NO=
WECHAT_PRIVATE_KEY_PATH=./certs/wechat.pem
WECHAT_NOTIFY_URL=${APP_BASE_URL}/api/v1/webhooks/pay/wechat
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=
ALIPAY_NOTIFY_URL=${APP_BASE_URL}/api/v1/webhooks/pay/alipay
ORDER_TIMEOUT_MIN=15                         #未支付订单关闭

# Income
PLATFORM_FEE_RATE=0.1                        #平台抽成 10%
INCOME_SETTLE_DAYS=7                         #T+N 结算

# Rate limit
RL_LOGIN_PER_MIN=10
RL_VERIFY_PER_HOUR=5
RL_PAY_PER_MIN=10

# Sentry (optional)
SENTRY_DSN=
```

### 4.2 `docker/docker-compose.yml`（dev）

Postgres + Redis + MinIO + mailhog/smtp4dev（邮件）+ app（可选）。给出完整 service 定义（image/ports/env/volumes/healthcheck）。MinIO 启动后 `mc` 建桶 `campus-market`。

### 4.3 pnpm scripts（`package.json`）

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "worker": "tsx src/server/jobs/scheduler.ts",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "prisma:generate": "prisma generate",
    "prisma:migrate:dev": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy",
    "db:seed": "tsx prisma/seed.ts",
    "db:seed:test": "tsx prisma/seed.test.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:cov": "vitest run --coverage",
    "test:integration": "vitest run --dir tests/integration",
    "test:e2e": "playwright test",
    "prepare": "husky install"
  }
}
```

### 4.4 启动顺序（开发）

1. `docker compose -f docker/docker-compose.yml up -d`（pg/redis/minio/mail）
2. `pnpm install`
3. `pnpm prisma:generate && pnpm prisma:migrate:dev && pnpm db:seed`
4. `pnpm dev`（另开终端）`pnpm worker`
5. `pnpm test` 验证基线

---

## 5. 数据库设计（Prisma schema 全量）

> 设计原则：① 金额一律 `Decimal @db.Decimal(10,2)`；② 计数（downloads/favs/likes/views/ratingCount）落字段冗余（事务维护，避免高频聚合）；③ 软删除用 `deletedAt`（作品/评论/通知）；④ 所有表 `createdAt/updatedAt`；⑤ 枚举用 Prisma `enum`（PostgreSQL 原生）；⑥ 唯一约束防重（关注/收藏/评分/点赞）。

### 5.1 generators/datasources

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }
```

### 5.2 enums

```prisma
enum Role { STUDENT CREATOR ADMIN }
enum UserStatus { ACTIVE BANNED DELETED }
enum EduVerifyStatus { UNVERIFIED PENDING VERIFIED REJECTED }

enum WorkStatus { DRAFT PENDING PUBLISHED REJECTED TAKEN_DOWN }
enum Quality { NORMAL HIGH SELECTED }
enum FileType { PDF DOC DOCX PPT PPTX ZIP IMAGE OTHER }

enum PayMethod { WECHAT ALIPAY MOCK }
enum PayStatus { PENDING PAID REFUNDED CLOSED FAILED }
enum OrderBizType { PURCHASE }

enum IncomeStatus { PENDING SETTLED WITHDRAWN }
enum PayoutStatus { REQUESTED PROCESSING COMPLETED REJECTED }
enum FollowStatus { ACTIVE }

enum ReportReason { INFRINGEMENT PIRACY MISMATCH PORN_GAMBLE_ILLEGAL SPAM OTHER }
enum ReportStatus { OPEN PROCESSING RESOLVED }
enum ReportTargetType { WORK COMMENT USER }

enum AuditAction { APPROVE REJECT TAKE_DOWN REQUEST_CHANGES }
enum DynamicType { PUBLISH UPDATE CHECKIN }

enum NotificationType { FOLLOW_NEW_WORK INCOME ARRIVED RATING_REPLIED AUDIT_RESULT SYSTEM }

enum AchievementKey { HELP_50 HELP_1000 FIRST_FIVE_STAR WEEKLY_HOT COLLEGE_EXCELLENT FIRST_INCOME }
```

### 5.3 用户与档案

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique                       // edu 邮箱
  username      String   @unique
  passwordHash  String
  passwordPepper String?                               // 迁移用
  role          Role     @default(STUDENT)
  status        UserStatus @default(ACTIVE)
  avatarColor   String   @default("#FF6B4A")
  bannedAt      DateTime?
  bannedReason  String?
  lastLoginAt   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?

  student       StudentProfile?
  creator       CreatorProfile?
  accounts      Account[]
  sessions      Session[]
  // 作品/订单/收藏/关注/评分/通知/举报 等关系（见各 model）
  works         Work[]       @relation("AuthoredWorks")
  orders        Order[]      @relation("BuyerOrders")
  downloads     Download[]
  favorites     Favorite[]
  likesWork     Like[]
  follows       Follow[]     @relation("Follower")
  followings    Follow[]     @relation("Following")
  ratings       WorkRating[]
  comments      Comment[]
  notifications Notification[]
  reports       Report[]     @relation("Reporter")
  payouts       Payout[]
  achievements  UserAchievement[]
  auditActions  AuditLog[]   @relation("AuditReviewer")

  @@index([status])
  @@map("users")
}

model StudentProfile {
  id            String          @id @default(cuid())
  userId        String          @unique
  user          User            @relation(fields:[userId],references:[id],onDelete:Cascade)
  eduEmail      String          @unique
  school        String
  college       String
  major         String
  grade         String
  studentCardKey String?                              // 学生证（创作者加固）
  verifyStatus  EduVerifyStatus @default(UNVERIFIED)
  verifiedAt    DateTime?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  @@map("student_profiles")
}

model CreatorProfile {
  id          String   @id @default(cuid())
  userId      String   @unique
  user        User      @relation(fields:[userId],references:[id],onDelete:Cascade)
  bio         String   @db.VarChar(500)
  direction   String                                  // 方向：数据库/AI/408…
  honor       String?                                 // 荣誉简述
  verified    Boolean  @default(false)                // 创作者认证（学生证人工）
  appliedAt   DateTime?
  reviewedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  wallet      Wallet?
  incomes     CreatorIncome[]
  payouts     Payout[]
  dynamics    Dynamic[]
  @@map("creator_profiles")
}
```

### 5.4 作品与内容

```prisma
model Work {
  id            String       @id @default(cuid())
  authorId      String
  author        User         @relation("AuthoredWorks", fields:[authorId],references:[id])
  title         String       @db.VarChar(120)
  description   String       @db.VarChar(800)
  course        String                                  // 适用课程
  fileType      FileType
  fileKey       String                                  // S3 key
  fileSize      Int                                       // 字节
  fileSha       String?                                  // 去重/校验
  pages         Int          @default(0)
  coverIcon     String       @default("📄")            // emoji
  coverTheme    String       @default("g-default")     // 对应原型 .g-*
  isFree        Boolean      @default(true)
  price         Decimal      @default(0) @db.Decimal(10,2)
  oldPrice      Decimal?     @db.Decimal(10,2)
  status        WorkStatus   @default(DRAFT)
  quality       Quality      @default(NORMAL)
  copyrightAccepted Boolean @default(false)
  applyMajor    String?
  applyGrade    String?
  applyCrowd    String?
  previewToc    Json                                     // 目录数组
  rating        Decimal      @default(0) @db.Decimal(3,1)
  ratingCount   Int          @default(0)
  ratingDist    Json         @default("{\"5\":0,\"4\":0,\"3\":0,\"2\":0,\"1\":0}")
  downloads     Int          @default(0)
  favs          Int          @default(0)
  likes         Int          @default(0)
  views         Int          @default(0)               // 写入即 +1（或异步）
  publishedAt   DateTime?
  rejectedReason String?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  deletedAt     DateTime?

  tags          WorkTag[]
  ratings       WorkRating[]
  comments      Comment[]
  orders        Order[]
  downloads_rel Download[]
  favorites     Favorite[]
  likes         Like[]
  dynamics      Dynamic[]
  reports       Report[]     @relation("ReportedWorks")
  auditLogs     AuditLog[]

  @@index([status, quality, publishedAt(sort:Desc)])
  @@index([authorId, status])
  @@index([course])
  @@map("works")
}

model Tag { id String @id @default(cuid()) name String @unique works WorkTag[] @@map("tags") }
model WorkTag {
  id String @id @default(cuid())
  workId String
  tagId String
  work Work @relation(fields:[workId],references:[id],onDelete:Cascade)
  tag Tag  @relation(fields:[tagId],references:[id])
  @@unique([workId, tagId])
  @@map("work_tags")
}
```

### 5.5 评分与评论

```prisma
model WorkRating {
  id           String   @id @default(cuid())
  workId       String
  userId       String
  work         Work     @relation(fields:[workId],references:[id],onDelete:Cascade)
  user         User     @relation(fields:[userId],references:[id])
  stars        Int                                             // 1..5
  text         String   @db.VarChar(600)
  helpfulCount Int      @default(0)
  creatorReply String?  @db.VarChar(600)
  repliedAt    DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  tags         WorkRatingTag[]
  @@unique([workId, userId])                                      // 每人每作品一次
  @@index([workId, createdAt(sort:Desc)])
  @@map("work_ratings")
}
model RatingTag { id String @id @default(cuid()) name String @unique isPositive Boolean @default(true) ratings WorkRatingTag[] @@map("rating_tags") }
model WorkRatingTag { id String @id @default(cuid()) ratingId String tagId String rating WorkRating @relation(fields:[ratingId],references:[id],onDelete:Cascade) tag RatingTag @relation(fields:[tagId],references:[id]) @@unique([ratingId, tagId]) @@map("work_rating_tags") }

model Comment {
  id String @id @default(cuid())
  workId String
  userId String
  parentId String?
  content String @db.VarChar(600)
  likes Int @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  work Work @relation(fields:[workId],references:[id],onDelete:Cascade)
  user User @relation(fields:[userId],references:[id])
  parent Comment? @relation("CommentReplies", fields:[parentId],references:[id])
  replies Comment[] @relation("CommentReplies")
  @@index([workId, createdAt(sort:Desc)])
  @@map("comments")
}
```

### 5.6 交易与权限

```prisma
model Order {
  id              String     @id @default(cuid())
  workId          String
  buyerId         String
  bizType         OrderBizType @default(PURCHASE)
  amount          Decimal    @db.Decimal(10,2)
  platformFee     Decimal    @db.Decimal(10,2)
  creatorAmount   Decimal    @db.Decimal(10,2)
  payMethod       PayMethod
  payStatus       PayStatus  @default(PENDING)
  transactionId   String?    @unique                          // 第三方流水（幂等）
  idempotencyKey  String?    @unique                          // 回调幂等键
  paidAt          DateTime?
  refundedAt      DateTime?
  expiresAt       DateTime?                                    // 超时关闭
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  work            Work       @relation(fields:[workId],references:[id])
  buyer           User       @relation("BuyerOrders", fields:[buyerId],references:[id])
  income          CreatorIncome?
  @@index([workId, payStatus])
  @@index([buyerId, createdAt(sort:Desc)])
  @@map("orders")
}

model Download {
  id        String   @id @default(cuid())
  workId    String
  userId    String
  orderId   String?                                       // 付费下载关联订单
  ip        String?
  createdAt DateTime @default(now())
  work      Work @relation(fields:[workId],references:[id])
  user      User @relation(fields:[userId],references:[id])
  @@unique([workId, userId])                              // 权限凭证：一行 = 有权
  @@map("downloads")
}
```

### 5.7 社交

```prisma
model Follow {
  id          String @id @default(cuid())
  followerId  String
  followingId String                                     // creator userId
  status      FollowStatus @default(ACTIVE)
  createdAt   DateTime @default(now())
  follower    User @relation("Follower", fields:[followerId],references:[id])
  following   User @relation("Following", fields:[followingId],references:[id])
  @@unique([followerId, followingId])
  @@index([followingId])
  @@map("follows")
}
model Favorite {
  id String @id @default(cuid())
  userId String workId String createdAt DateTime @default(now())
  user User @relation(fields:[userId],references:[id])
  work Work @relation(fields:[workId],references:[id])
  @@unique([userId, workId])
  @@map("favorites")
}
model Like {
  id String @id @default(cuid())
  userId String workId String createdAt DateTime @default(now())
  user User @relation(fields:[userId],references:[id])
  work Work @relation(fields:[workId],references:[id])
  @@unique([userId, workId])
  @@map("likes")
}
model Dynamic {
  id String @id @default(cuid())
  creatorId String                                     // creator userId
  type DynamicType
  workId String?
  createdAt DateTime @default(now())
  creator User @relation(fields:[creatorId],references:[id])
  work Work? @relation(fields:[workId],references:[id])
  @@index([creatorId, createdAt(sort:Desc)])
  @@map("dynamics")
}
```

### 5.8 创作者经济

```prisma
model Wallet {
  id String @id @default(cuid())
  creatorId String @unique
  balance Decimal @default(0) @db.Decimal(10,2)         // 可提现
  pending Decimal @default(0) @db.Decimal(10,2)         // 待结算
  withdrawn Decimal @default(0) @db.Decimal(10,2)       // 累计已提
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  creator CreatorProfile @relation(fields:[creatorId],references:[id])
  @@map("wallets")
}
model CreatorIncome {
  id String @id @default(cuid())
  creatorId String
  orderId String @unique
  amount Decimal @db.Decimal(10,2)
  status IncomeStatus @default(PENDING)
  settleAt DateTime?                                    // createdAt + T+7
  settledAt DateTime?
  createdAt DateTime @default(now())
  creator CreatorProfile @relation(fields:[creatorId],references:[id])
  order Order @relation(fields:[orderId],references:[id])
  @@index([status, settleAt])
  @@map("creator_incomes")
}
model Payout {
  id String @id @default(cuid())
  creatorId String
  amount Decimal @db.Decimal(10,2)
  method PayMethod @default(WECHAT)
  status PayoutStatus @default(REQUESTED)
  channelTxId String?
  requestedAt DateTime @default(now())
  completedAt DateTime?
  rejectedReason String?
  creator CreatorProfile @relation(fields:[creatorId],references:[id])
  user User @relation("PayoutsByUser", fields:[creatorId],references:[id])
  @@index([creatorId, requestedAt(sort:Desc)])
  @@map("payouts")
}
```

### 5.9 通知/举报/审核/成就

```prisma
model Notification {
  id String @id @default(cuid())
  userId String type NotificationType text String link String? read Boolean @default(false) createdAt DateTime @default(now())
  user User @relation(fields:[userId],references:[id],onDelete:Cascade)
  @@index([userId, read, createdAt(sort:Desc)])
  @@map("notifications")
}
model Report {
  id String @id @default(cuid())
  reporterId String
  targetType ReportTargetType
  targetId String
  reason ReportReason
  detail String? @db.VarChar(600)
  status ReportStatus @default(OPEN)
  handlerId String?
  handleNote String?
  handledAt DateTime?
  createdAt DateTime @default(now())
  reporter User @relation("Reporter", fields:[reporterId],references:[id])
  works Work[] @relation("ReportedWorks")              // 若 targetType=WORK 反查
  @@index([status, createdAt(sort:Desc)])
  @@map("reports")
}
model AuditLog {
  id String @id @default(cuid())
  workId String action AuditAction reviewerId String note String? createdAt DateTime @default(now())
  work Work @relation(fields:[workId],references:[id])
  reviewer User @relation("AuditReviewer", fields:[reviewerId],references:[id])
  @@index([workId, createdAt(sort:Desc)])
  @@map("audit_logs")
}
model Achievement { id String @id @default(cuid()) key AchievementKey @unique emoji String title String @@map("achievements") }
model UserAchievement { id String @id @default(cuid()) userId String achievementId String earnedAt DateTime @default(now()) user User @relation(fields:[userId],references:[id]) achievement Achievement @relation(fields:[achievementId],references:[id]) @@unique([userId, achievementId]) @@map("user_achievements") }
```

### 5.10 NextAuth 表（JWT 策略下可只保留必要；DB adapter 可选）

```prisma
model Account { /* 标准 Auth.js Account，userId 关联 User */ }
model Session { /* 若用 DB session；本项目默认 JWT，可省 */ }
```

> V5 已删除无引用的 `VerificationToken`（verification_tokens 表，Auth.js 备用残留）。

> **seed**：`prisma/seed.ts` 创建学校字典（深圳大学/学院/专业）、`Achievement` 字典（6 个，对应原型 achievements）、4–5 个示例创作者（林知行/苏漫/陈昱/周柠/何思远）+ 其作品（沿用原型数据，字段补齐 rating/ratingCount/ratingDist/downloads 等），便于前端联调。

---

## 6. 鉴权设计

### 6.1 注册流程（深大 edu 邮箱）

1. `POST /api/v1/auth/send-code { email }` → 校验 `EDU_EMAIL_REGEX`（默认仅 szu.edu.cn 及子域）→ Redis 存 `verify:register:email:{email}` → 6 位码 TTL 10 分钟 → 限流 `RL_VERIFY_PER_HOUR`。
2. `POST /api/v1/auth/register { email, code, username, password, school, college, major, grade }` → 校验码 → bcrypt(password+pepper) → 事务建 `User(STUDENT)`+`StudentProfile(VERIFIED,verifiedAt=now)` → 删码 → 签发 JWT cookie（含 `pwdVer` claim）。
3. 忘记密码：`POST /auth/forgot-password`（未注册邮箱同样返回 ok 但不发，防枚举；码存 `verify:reset:email:{email}`）；`POST /auth/reset-password`（消费 reset 码 + 新密码，`pwdVersion` 自增 → 全端会话 401）。登录态改密：`POST /auth/change-password`（旧密码验证，同样自增 `pwdVersion`）。
4. 角色：默认 STUDENT；创建 CreatorProfile 需 `POST /api/v1/me/creator/apply`（bio/direction/honor + 可选学生证）→ 管理员 `POST /admin/creators/:id/audit` 通过后 `verified=true`、role 升 CREATOR。

### 6.2 登录 / 会话

- `POST /api/v1/auth/login { email, password }` → 校验 → JWT(httpOnly, Secure, SameSite=Lax) 写 cookie；refresh 走滑动续期（剩余 < 1/3 寿命时刷新）。
- `GET /api/v1/auth/me` 返回当前用户 + role + creator 状态 + 未读通知数。
- `POST /api/v1/auth/logout` 清 cookie。
- Auth.js v5 `credentials` provider，`jwt` 回调注入 `{ id, role, creatorId }`；`session` 回调透传。

### 6.3 RBAC 与中间件

- `src/server/auth/session.ts`：`getSession()` / `requireUser()` / `requireCreator()` / `requireAdmin()`（不满足抛 `AppError('FORBIDDEN')`）。
- `src/middleware.ts`：matcher `/api/v1`（除 `auth/*`、`webhooks/*`、`works` GET 列表/详情、`search`、`ranks`、`creators/:id` GET），其余无 cookie → 401。
- 权限矩阵（关键）：
  | 操作                | STUDENT | CREATOR                   | ADMIN |
  | ------------------- | ------- | ------------------------- | ----- |
  | 上传作品            | —       | ✅（需 creator verified） | ✅    |
  | 审核/下架           | —       | —                         | ✅    |
  | 提现                | —       | ✅（本人钱包）            | —     |
  | 评分/购买/收藏/关注 | ✅      | ✅                        | ✅    |

### 6.4 限流

- `server/lib/ratelimit.ts` 基于 Redis 滑窗：登录 `RL_LOGIN_PER_MIN`、验证码 `RL_VERIFY_PER_HOUR`、重置码发送 `RL_RESET_PER_HOUR`（默认 5/h）、重置码尝试 `RL_RESET_TRY_PER_HOUR`（默认 10/h，防 6 位码爆破）、改密 `RL_PWD_PER_MIN`（默认 10/min）、支付 `RL_PAY_PER_MIN`、上传每用户 10/小时、举报每用户 5/小时。
- 超限 → 429 + `Retry-After`。

### 6.5 安全清单（必须实现）

- bcrypt cost=12 + pepper；密码最短 8 位含字母数字。
- 防用户名枚举：注册/验证码命中已存在邮箱也返回「已发送」（但实际不发），登录错误统一「邮箱或密码错误」。
- CSRF：SameSite=Lax + 关键写操作校验 `Origin/Referer`；webhook 单独验签。
- 越权：所有「按 id 查/改/删」先校验 ownership（`authorId===user.id`、`buyerId===user.id`、`creatorId===user.id`）。
- 注入：Prisma 参数化 + Zod 校验，禁拼 SQL。
- XSS：富文本（评价/评论）服务端 `sanitize-html` 白名单；输出 React 默认转义。
- 重放：支付回调验签 + `transactionId/idempotencyKey` 唯一。
- 敏感字段：`passwordHash/verifyCode/钱包余额` 不入日志；日志脱敏中间件。

---

## 7. API 设计（逐端点，前缀 `/api/v1`）

> 通用约定见 `API_CONTRACT.md`：分页 `?page=1&pageSize=20`，响应 `{ data, pagination }` 或 `{ data }`，错误 `{ error: { code, message, details? } }`，鉴权 cookie 自动携带。下表给出**每个端点的契约摘要**，Zod 定义在 `src/lib/zod/*`（前后端共享类型）。
>
> ⚠️ **最终契约以 `API_CONTRACT.md` 为准**：下表为摘要，凡字段/错误码/返回结构与契约不一致时，**一律以 `API_CONTRACT.md` 为准实现**。BACKEND 必须实现契约中列出的**全部**端点，包括下表摘要里未展开的：`GET /works/:id/ratings/tags`(返回可选评价标签 pos/neg，或前端用共享常量)、`GET /creators/:id/dynamics`(创作者主页动态流)、`POST /admin/creators/:id/audit`(创作者认证审核)。收藏/关注/点赞的返回一律带权威新计数（`{favorited,favs}`/`{followed,fans}`/`{liked,likes}`）；`send-code` 的邮箱格式错误用 `VALIDATION`、非 edu 用 `NOT_EDU`（不使用 `INVALID_EMAIL`）。

### 7.1 鉴权

| #   | Method Path              | 鉴权 | 请求体                                                        | 成功响应                                   | 错误码                                               |
| --- | ------------------------ | ---- | ------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| A1  | POST `/auth/send-code`   | 公开 | `{ email }`                                                   | `{ ok:true }`                              | INVALID_EMAIL/NOT_EDU/RATE_LIMITED                   |
| A2  | POST `/auth/register`    | 公开 | `{ email,code,username,password,school,college,major,grade }` | `AuthUser`                                 | CODE_INVALID/CODE_EXPIRED/EMAIL_TAKEN/USERNAME_TAKEN |
| A3  | POST `/auth/login`       | 公开 | `{ email,password }`                                          | `AuthUser`(set-cookie)                     | INVALID_CREDENTIAL/RATE_LIMITED                      |
| A4  | POST `/auth/logout`      | 登录 | —                                                             | `{ ok:true }`                              | —                                                    |
| A5  | GET `/auth/me`           | 登录 | —                                                             | `AuthUser`(含 unreadCount, creatorProfile) | UNAUTHENTICATED                                      |
| A6  | POST `/me/creator/apply` | 登录 | `{ bio,direction,honor,studentCardKey? }`                     | `CreatorProfile`(PENDING)                  | ALREADY_CREATOR                                      |

### 7.2 作品

| #   | Method Path               | 鉴权         | 请求                                                                                                                                                                              | 响应                                                           | 备注                                 |
| --- | ------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------ |
| W1  | GET `/works`              | 公开         | query:page,pageSize,creatorId,isFree,quality,fileType,minRating,updatedSince,sort(complex/hot/rate/new/price),course                                                              | `{ data:WorkListItem[], pagination }`                          | 复合排序见 8.4                       |
| W2  | GET `/works/:id`          | 公开(带会话) | —                                                                                                                                                                                 | `WorkDetail`(含 author, myFav, myAccess, myRating, ratingDist) | 浏览 +1；付费未购时 previewOnly=true |
| W3  | POST `/works`             | CREATOR      | `{ title,desc,course,fileType,fileKey,fileSize,pages?,coverIcon?,coverTheme?,isFree,price?,oldPrice?,applyMajor?,applyGrade?,applyCrowd?,tags[],previewToc[],copyrightAccepted }` | `Work`(DRAFT)                                                  | 校验 copyrightAccepted=true          |
| W4  | PUT `/works/:id`          | owner        | 同上部分                                                                                                                                                                          | `Work`                                                         | 仅 DRAFT/PENDING 可改                |
| W5  | POST `/works/:id/publish` | owner        | —                                                                                                                                                                                 | `Work`(PENDING)                                                | 进审核流                             |
| W6  | DELETE `/works/:id`       | owner/admin  | —                                                                                                                                                                                 | `{ ok }`                                                       | 软删                                 |
| W7  | GET `/works/:id/related`  | 公开         | —                                                                                                                                                                                 | `WorkListItem[]`                                               | 同作者/同标签                        |

### 7.3 评分评价

| #   | Method Path                  | 鉴权           | 请求                                  | 响应                                                               | 业务                   |
| --- | ---------------------------- | -------------- | ------------------------------------- | ------------------------------------------------------------------ | ---------------------- |
| R1  | GET `/works/:id/ratings`     | 公开           | query:sort(new/helpful/high/low),page | `{ data:Rating[], pagination, summary:{rating,ratingCount,dist} }` | —                      |
| R2  | POST `/works/:id/ratings`    | 登录+hasAccess | `{ stars,text,tags[] }`               | `Rating`                                                           | 见 8.1；事务重算 Work  |
| R3  | POST `/ratings/:rid/helpful` | 登录           | —                                     | `{ helpfulCount }`                                                 | +1（去重用 Redis set） |
| R4  | POST `/ratings/:rid/reply`   | 该作品作者     | `{ text }`                            | `Rating`(含 creatorReply)                                          | —                      |
| R5  | GET `/me/ratings`            | 登录           | —                                     | `MyRating[]`                                                       | 含 work 摘要           |

### 7.4 购买 / 支付 / 下载

| #   | Method Path                 | 鉴权           | 请求            | 响应                                | 业务                                    |
| --- | --------------------------- | -------------- | --------------- | ----------------------------------- | --------------------------------------- |
| O1  | POST `/works/:id/order`     | 登录           | `{ payMethod }` | `{ orderId, pay }` (pay 含拉起参数) | 见 10；已购/已下载直接返回 access       |
| O2  | POST `/orders/:id/pay`      | 登录(owner)    | —               | `{ pay }` 或 mock `{ paid:true }`   | 二次发起；mock 立即回调                 |
| O3  | POST `/webhooks/pay/wechat` | 验签           | 微信 v3 body    | `{ code:'SUCCESS' }`                | 10.3                                    |
| O4  | POST `/webhooks/pay/alipay` | 验签           | 支付宝 body     | `success`                           | 10.3                                    |
| O5  | GET `/orders/:id`           | 登录(owner)    | —               | `Order`                             | 查单                                    |
| O6  | POST `/works/:id/download`  | 登录+hasAccess | —               | `{ url, expiresIn }`                | 返回 presigned GET，写 Download（幂等） |

### 7.5 收藏 / 关注 / 点赞

| #   | Method Path                   | 鉴权 | 响应                                          | 备注                         |
| --- | ----------------------------- | ---- | --------------------------------------------- | ---------------------------- |
| F1  | POST `/works/:id/favorite`    | 登录 | `{ favorited }`                               | 切换；乐观更新；Work.favs ±1 |
| F2  | DELETE `/works/:id/favorite`  | 登录 | `{ favorited:false }`                         | —                            |
| F3  | POST `/creators/:id/follow`   | 登录 | `{ followed }`                                | 切换；通知 + 首条动态推送    |
| F4  | DELETE `/creators/:id/follow` | 登录 | `{ followed:false }`                          | —                            |
| F5  | POST `/works/:id/like`        | 登录 | `{ liked }`                                   | Work.likes +1                |
| F6  | GET `/me/following/feed`      | 登录 | `Dynamic[]`                                   | 关注创作者动态聚合           |
| F7  | GET `/me/favorites`           | 登录 | `WorkListItem[]`                              | —                            |
| F8  | GET `/creators/:id`           | 公开 | `CreatorDetail`(profile,stats,works,myFollow) | —                            |
| F9  | GET `/creators/:id/works`     | 公开 | `WorkListItem[]`                              | filter=free/fine/hot         |
| F10 | GET `/creators/:id/stats`     | 公开 | `{ helped,fans,works,avgRating }`             | —                            |

### 7.6 我的 / 创作者中心 / 收益

| #   | Method Path                       | 鉴权    | 响应                                                                 |
| --- | --------------------------------- | ------- | -------------------------------------------------------------------- |
| M1  | GET `/me/library`                 | 登录    | `LibraryItem[]`(filter=all/bought/download/fav/todo/rated)           |
| M2  | GET `/me/orders`                  | 登录    | `Order[]`                                                            |
| M3  | GET `/me/notifications`           | 登录    | `Notification[]`                                                     |
| M4  | POST `/me/notifications/read-all` | 登录    | `{ ok }`                                                             |
| C1  | GET `/me/creator/overview`        | CREATOR | `{ helped,income{total,month,pending,withdrawable},fans,avgRating }` |
| C2  | GET `/me/creator/works`           | CREATOR | `WorkWithStats[]`(含审核状态)                                        |
| C3  | GET `/me/creator/data`            | CREATOR | 每作品浏览/下载/收藏/评分/收益                                       |
| I1  | GET `/me/income/summary`          | CREATOR | 钱包四值 + 本月                                                      |
| I2  | GET `/me/income/transactions`     | CREATOR | `CreatorIncome[]`                                                    |
| I3  | POST `/me/income/payout`          | CREATOR | `{ payout }`(REQUESTED)                                              | 校验 amount ≤ balance；事务 Wallet.balance-amount, withdrawn+amount |
| I4  | GET `/me/income/payouts`          | CREATOR | `Payout[]`                                                           |

### 7.7 搜索 / 排行榜 / 上传 / 举报 / 通知 / 管理

| #   | Method Path                   | 鉴权    | 说明                                                                                                |
| --- | ----------------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| S1  | GET `/search`                 | 公开    | q,type(all/works/creator/line/guide/fine),filters,sort → 复用 works 查询 + 创作者匹配；PG `pg_trgm` |
| K1  | GET `/ranks/:type`            | 公开    | help/rate/fav/creator；Redis 缓存                                                                   |
| U1  | POST `/uploads/presign`       | CREATOR | `{ fileType,fileSize,sha }` → 返回 `{ fileKey, putUrl }`；校验白名单+大小                           |
| N1  | GET `/notifications`          | 登录    | 见 M3                                                                                               |
| RP1 | POST `/reports`               | 登录    | `{ targetType,targetId,reason,detail }`                                                             |
| AD1 | GET `/admin/works/pending`    | ADMIN   | 待审核列表                                                                                          |
| AD2 | POST `/admin/works/:id/audit` | ADMIN   | `{ action:APPROVE/REJECT/TAKE_DOWN, note }` → 写 AuditLog + 通知 + 状态                             |
| AD3 | GET `/admin/reports`          | ADMIN   | 举报队列                                                                                            |
| AD4 | POST `/admin/reports/:id`     | ADMIN   | `{ status,note }`                                                                                   |
| AD5 | POST `/admin/payouts/:id`     | ADMIN   | `{ action:complete/reject, channelTxId? }`                                                          |

> **每条 API 的完整 Zod（请求/响应）放在 `src/lib/zod/*` 并 export 类型；本文档要求实现时逐条对照 `API_CONTRACT.md`，字段不得偏差。**

---

## 8. 业务规则（集中定义）

### 8.1 评分资格与重算（`algos/rating.ts`）

- 资格：`(Download 存在) OR (Order.paid 存在)`；且 `WorkRating` 不存在。
- 提交（事务）：
  1. `INSERT WorkRating`（唯一约束兜底）；
  2. 读旧 `rating/ratingCount/ratingDist`，重算：`newCount=old+1`，`newRating=((oldRating*oldCount)+stars)/newCount`（保留 1 位），`dist[stars]+=1`；
  3. `UPDATE Work` 写回；
  4. 触发成就（首个五星等）。
- 并发：用 `SELECT ... FOR UPDATE` 锁 Work 行，或 PG 原子 `UPDATE ... SET rating=...` 表达式；单测覆盖 100 并发同评分后 `ratingCount==old+100`。

### 8.2 收益计算与结算（`algos/income.ts` + jobs）

- 抽成：`platformFee = round(price * PLATFORM_FEE_RATE, 2)`；`creatorAmount = price - platformFee`。
- 支付成功（事务）：
  1. `Order.payStatus=PAID, paidAt, transactionId`（幂等：已 PAID 直接 return SUCCESS）；
  2. `INSERT Download`（购后即有权）；
  3. `INSERT CreatorIncome(status=PENDING, settleAt=paidAt+T+7)`；
  4. `Wallet.pending += creatorAmount`；
  5. `Work.downloads += 1`（购买计下载）；
  6. 通知买家 + Dynamic（创作者「售出」可选不公开）。
- 结算定时任务（每日）：`CreatorIncome WHERE status=PENDING AND settleAt<=now` → 事务 `Wallet.pending-=amount, Wallet.balance+=amount, income.status=SETTLED`。
- 提现：`POST payout` → 校验 `amount<=Wallet.balance` → 事务 `Wallet.balance-=amount, Wallet.withdrawn+=amount, INSERT Payout(REQUESTED)`；管理员 `AD5` complete → `channelTxId` + `completedAt`，或 reject → 回滚钱包。

### 8.3 质量（`algos/quality.ts`）

- `SELECTED`：仅管理员/AI 手工标记（`AD2` 或后台）。
- `HIGH`：定时任务扫描 `rating>=4.8 AND ratingCount>=20 AND downloads>=500 AND status=PUBLISHED` → 设 HIGH（可降级：跌破阈值回 NORMAL）。
- `NORMAL`：默认。

### 8.4 排行榜（`algos/rank.ts` + 每小时 job）

- `help`：创作者 `helped = Σ(其 Work.downloads)`（聚合 SQL），取 top。
- `rate`：创作者 `rating*ratingCount` 加权。
- `fav`：Work `favs` top。
- `creator`：创作者 `fans*works` 加权。
- 结果写 Redis `rank:{type}` TTL 1h；接口直读 Redis。

### 8.5 审核状态机

```
DRAFT --publish--> PENDING --admin:APPROVE--> PUBLISHED
PENDING --admin:REJECT--> REJECTED (可改后重提)
PUBLISHED --admin:TAKE_DOWN/版权命中--> TAKEN_DOWN
```

- 上传默认 DRAFT；`copyrightAccepted` 强制；PENDING 起进 `admin/works/pending`；APPROVE 写 `publishedAt=now` + Dynamic(PUBLISH) + 通知粉丝。

### 8.6 访问权限（下载/预览）

- 免费：任何人登录即可 `download`（写 Download）。
- 付费：`hasAccess = Download exists OR Order.paid exists`；否则只能 preview（前 N 页/目录，前端模糊）。
- `GET /works/:id` 返回 `myAccess` 标志供前端切换按钮。

---

## 9. 文件上传

1. `POST /uploads/presign`：服务端校验 `fileType ∈ 白名单`、`fileSize ≤ 200MB`、`sha` 未被禁（黑名单/去重可选）→ 生成 `fileKey = works/{userId}/{cuid()}.{ext}` → MinIO `getSignedUrl(PUT, 5min)`。
2. 前端直传 → 回填 fileKey 调 `POST /works`。
3. 发布审核时服务端 `headObject` 校验文件确实存在 + 大小匹配。
4. 下载：`POST /works/:id/download` → `getSignedUrl(GET, 10min)`，`Content-Disposition: attachment`。
5. （可选）审核钩子调 ClamAV 扫毒；命中 → REJECTED + 通知。

---

## 10. 支付集成

### 10.1 抽象（`server/payment/index.ts`）

```ts
type PayProvider = { createOrder(o): Promise<{ prepayId, payParams }> ; verifyNotify(req): NotifyResult ; queryOrder(outTradeNo): OrderState ; refund(...) };
export function getProvider(method: PayMethod): PayProvider  // PAYMENT_MODE 分发
```

### 10.2 下单（`POST /works/:id/order`）

1. 幂等：该用户对该作品若已有 PAID Order/Download → 直接返回 access。
2. 建 `Order(PENDING, amount=price, platformFee, creatorAmount, expiresAt=now+ORDER_TIMEOUT_MIN)`。
3. `getProvider(payMethod).createOrder(order)` → 返回拉起参数（微信 code_url/mweb_url；支付宝跳转 URL；mock `{ paid:true }`）。
4. 返回 `{ orderId, pay }` 给前端。

### 10.3 异步回调（webhook）

- `POST /webhooks/pay/{wechat,alipay}` → `verifyNotify`（微信 v3 签名 + APIv3 解密；支付宝 RSA2 验签）。
- 幂等键 `idempotencyKey = provider + ':' + transactionId`；`Order.idempotencyKey` 唯一约束兜底。
- 处理（事务，见 8.2）→ 返回提供方要求的应答（微信 `{code:'SUCCESS'}`，支付宝 `success`）。
- 失败/异常：记录 + 不 ack，等重试。

### 10.4 主动查单兜底

- 定时任务每分钟扫 `Order.PENDING AND createdAt<now-30s` → `queryOrder` → 命中已支付则补跑 8.2 事务（幂等）。
- 超时（`expiresAt`）→ `Order.CLOSED`。

### 10.5 退款

- `POST /admin/orders/:id/refund`（或买家 24h 内自助）→ 调 provider.refund → `Order.REFUNDED` + `Wallet` 扣回 `creatorAmount` + `CreatorIncome.status=WITHDRAWN`（或冲减）+ 撤销 Download + 通知。

### 10.6 mock 模式

- `PAYMENT_MODE=mock` 时 `getProvider` 返回 mock：`createOrder` 立即返回 `{ paid:true }` 并**内部直接触发 8.2 事务**（同步支付成功），前端无需跳转，便于本地 E2E。

---

## 11. 定时任务（BullMQ + scheduler.ts）

| 名称            | cron          | 逻辑                                    |
| --------------- | ------------- | --------------------------------------- |
| income-settle   | `0 3 * * *`   | 结算到期 CreatorIncome → Wallet.balance |
| rank-refresh    | `0 * * * *`   | 重算 4 榜写 Redis                       |
| order-timeout   | `* * * * *`   | 关闭超时 PENDING 订单                   |
| notify-cleanup  | `0 4 * * 0`   | 删除 90 天已读通知                      |
| quality-refresh | `30 3 * * *`  | HIGH/NORMAL 升降级                      |
| pay-reconcile   | `*/5 * * * *` | 查单兜底（10.4）                        |

> `pnpm worker` 起 scheduler；生产同容器/独立容器均可。

---

## 12. 测试方案

### 12.1 分层与覆盖率

- **单元**（`tests/unit`，`server/algos/*` 纯函数 + zod）：≥90%。
- **集成**（`tests/integration`，真实 PG test schema + Redis db15 + MinIO testcard，每个 API + service）：≥85%。
- **契约**：`src/lib/zod/*` 既是类型源也跑「响应样本校验」。
- **E2E**（`e2e`，Playwright，mock 支付）：覆盖 7 条核心路径。

### 12.2 测试基建

- `tests/setup.ts`：连接 `DATABASE_URL_TEST`，`prisma migrate reset --force` + `seed:test`；每用例 `beforeEach` 清表（按依赖序）。
- `tests/factories.ts`：`makeUser/Student/Creator/Work/Order(paid)/Download/Rating/...`，支持参数覆盖。
- `tests/helpers/api.ts`：`withSession(user)` 返回带 cookie 的 `request`（用 Auth.js 真实签发或注入 JWT）。
- 外部依赖：smtp4dev（邮件）、minio testcard、`PAYMENT_MODE=mock`。

### 12.3 必须覆盖的用例（举例，非穷尽）

- 评分：未购买/未下载 → 403；购买后评分成功；重复评分 → 409；并发 100 同评 → ratingCount 正确。
- 订单：重复回调（同 transactionId）→ 只生效一次；mock 支付 → Download 生成 + Work.downloads+1 + Wallet.pending+creatorAmount。
- 收益：结算任务把 PENDING→SETTLED 且钱包迁移正确；提现超额 → 400；提现后管理员拒绝 → 回滚。
- 权限：A 用户改 B 用户作品 → 403；STUDENT 上传 → 403；未认证访问 `/me/*` → 401。
- 审核：PENDING → APPROVE 生成 Dynamic + 通知粉丝；REJECT 带 reason；TAKE_DOWN 隐藏。
- 排行榜：数据变更后 job 刷新 Redis 正确。
- 上传：类型/大小校验；presign 后未上传 → 发布校验失败。
- 限流：连续登录超阈值 → 429。

### 12.4 E2E 脚本（对应原型 7 路径）

1. 注册(edu 验证码) → 登录 → 首页 → 点作品 → 购买(mock) → 下载 → 评分 → 评价出现。
2. 关注创作者 → 动态流出现新作品。
3. 创作者发布(上传 → 信息 → 定价 → 版权 → 提交) → 审核通过 → 我的资料出现。
4. 收藏 → 首页卡片态 → 我的收藏。
5. 举报作品 → 管理员处理。
6. 收益明细 + 提现申请 → 管理员完成。
7. 搜索 → 筛选/排序 → 详情。

---

## 13. 安全 / 可观测 / 合规

- 日志：Pino 结构化；`requestId` 中间件注入；敏感字段脱敏（`email→e***, phone, password, wallet`）；HTTP 访问日志。
- 错误：`AppError(code,message,details)` + 全局 route handler 捕获 → 统一响应；Sentry 上报 5xx。
- 审计：`AuditLog`（作品）+ 关键写操作（提现/退款/下架/封号）写 `admin_audit` 日志表（可选）。
- 备份：PostgreSQL 每日 `pg_dump`（compose 给 backup service）+ WAL 归档（生产建议）。
- 合规：用户协议/隐私政策页（前端）；支付合规遵循提供方要求；版权：上传强制声明 + DM式举报 + 重复侵权封号。
- 健康检查：`GET /api/health`（DB/Redis/MinIO ping）。

---

## 14. 分阶段实施（每阶段：目标 / 改动 / 测试 / 反思）

> **每阶段流程**：实施 → 跑该阶段测试清单全绿 → 在 `docs/PROGRESS.md` 记录「做了什么/遇到什么问题/设计是否需调整/下阶段是否受影响」→ 进入下一阶段。

### 阶段 0 — 脚手架

- 目标：可跑、可测、可 lint 的空架子。
- 改动：`package.json`/`tsconfig`/`next`/`prisma`/`vitest`/`playwright`/`eslint`/`docker`/`.env.example`/`src/app/layout.tsx`/`/api/health`。
- 测试：`pnpm lint && pnpm typecheck && pnpm test`(空通过) && `docker compose up -d` 三服务 healthy。
- 反思：版本是否冲突？Auth.js v5 是否与 Next 14 兼容？

### 阶段 1 — 数据模型

- 改动：`prisma/schema.prisma`（全 model）+ 迁移 + `seed.ts`/`seed.test.ts`。
- 测试：迁移无误；seed 后各表行数；唯一约束（重复关注/评分）抛错。
- 反思：计数冗余是否齐全？索引是否覆盖列表查询？

### 阶段 2 — 鉴权

- 改动：`auth/*`、`send-code/register/login/logout/me`、`creator/apply`、RBAC 中间件、限流。
- 测试：edu 正则、验证码 TTL/限流、注册/登录/会话/越权/封号；权限矩阵用例。
- 反思：JWT 续期策略是否会并发丢会话？

### 阶段 3 — 作品

- 改动：`work.service`、works API、上传 presign、审核状态机（admin）。
- 测试：CRUD 权限、状态机迁移、presign 校验、views 计数。
- 反思：列表复合排序 SQL 是否走索引？

### 阶段 4 — 交易与支付

- 改动：`order/payment`、orders/pay/webhooks/download、mock+真实 provider、查单兜底。
- 测试：下单/支付/mock/回调幂等/查单/退款/下载权限。
- 反思：回调验签失败如何排错？对账差异如何发现？

### 阶段 5 — 评分评价

- 改动：`rating.service`/`algos/rating`、ratings API。
- 测试：资格/重算/并发/标签/作者回复/helpful 去重。
- 反思：锁粒度（Work 行）是否成热点？

### 阶段 6 — 社交

- 改动：`social.service`、favorite/like/follow/dynamic/notifications、关注动态聚合。
- 测试：切换幂等/计数一致/动态推送/通知生成。
- 反思：关注流大粉丝量下的分页性能？

### 阶段 7 — 创作者经济

- 改动：`income.service`/`algos/income`、creator-center/income API、结算/提现 job。
- 测试：抽成/结算/钱包/提现超额/管理员拒绝回滚。
- 反思：Decimal 运算精度（用 Prisma Decimal 而非 JS number）。

### 阶段 8 — 搜索/排行/质量

- 改动：`search/rank/quality`、pg_trgm 迁移、rank Redis 缓存、quality job。
- 测试：搜索召回/排序、榜单刷新、质量升降级。
- 反思：pg_trgm 中文分词是否需 zhparser/jieba？先简单 like+trgm，预留 Meilisearch。

### 阶段 9 — 治理

- 改动：`report/audit`、admin API、版权声明强制、重复侵权策略。
- 测试：举报/处置/下架/通知/封号。
- 反思：举报阈值如何配置化？

### 阶段 10 — E2E/性能/安全/部署

- E2E 7 路径全绿；性能：列表接口 p95<300ms（N+1 检查用 `prisma.join`/include）；安全：`docker scout`/`zap-baseline` 扫描；部署：`docker-compose.prod.yml` + 迁移 + healthcheck + runbook。
- 反思：备份数据从哪导？证书从哪来？

---

## 15. 部署

- `docker/Dockerfile`（multi-stage：deps→build→run，非 root）。
- `docker-compose.prod.yml`：app / postgres（卷）/ redis（持久化）/ minio（卷）/ caddy/nginx（TLS 反代 + 静态）/ backup（pg_dump cron）。
- 部署步骤：`git pull` → `pnpm install --prod` → `prisma migrate deploy` → `seed`（仅首次）→ `build` → `up -d`。
- 健康检查：`/api/health`；滚动更新策略 `restart: unless-stopped` + 资源限制。
- 运维 runbook：日志位置、常见 5xx 排查、支付对账脚本、回滚迁移注意（Prisma 不支持 down，用新迁移回滚）。

---

## 附：关键代码骨架示例

### AppError + 错误码（`server/lib/errors.ts`）

```ts
export const ErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  NOT_EDU: 'NOT_EDU',
  CODE_INVALID: 'CODE_INVALID',
  CODE_EXPIRED: 'CODE_EXPIRED',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  INVALID_CREDENTIAL: 'INVALID_CREDENTIAL',
  NO_RATING_ACCESS: 'NO_RATING_ACCESS',
  ALREADY_RATED: 'ALREADY_RATED',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  ORDER_CLOSED: 'ORDER_CLOSED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  COPYRIGHT_REQUIRED: 'COPYRIGHT_REQUIRED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_TYPE_DENIED: 'FILE_TYPE_DENIED',
  INTERNAL: 'INTERNAL',
} as const;
export class AppError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    public details?: any,
  ) {
    super(message);
  }
}
export const httpStatusByCode: Record<string, number> = {
  /* 401/403/404/400/409/429/402/500 映射 */
};
```

### 路由薄层示例（`app/api/v1/works/[id]/ratings/route.ts`）

```ts
import { requireUser } from '@/server/auth/session';
import { ratingService } from '@/server/services/rating.service';
import { CreateRatingInput } from '@/lib/zod/rating';
import { withErrorHandler } from '@/server/lib/http';

export const POST = withErrorHandler(async (req, ctx) => {
  const user = await requireUser();
  const body = CreateRatingInput.parse(await req.json());
  const rating = await ratingService.create({ workId: ctx.params.id, userId: user.id, ...body });
  return Response.json({ data: rating }, { status: 201 });
});
```

### service 事务示例（评分）

```ts
async create({workId,userId,stars,text,tags}) {
  return prisma.$transaction(async tx => {
    const access = await tx.order.findFirst({where:{workId,buyerId:userId,payStatus:'PAID'}})
                || await tx.download.findUnique({where:{workId_userId:{workId,userId}}});
    if(!access) throw new AppError('NO_RATING_ACCESS',403,'未购买或下载，无法评价');
    const existing = await tx.workRating.findUnique({where:{workId_userId:{workId,userId}}});
    if(existing) throw new AppError('ALREADY_RATED',409,'已评价');
    const rating = await tx.workRating.create({data:{workId,userId,stars,text}});
    await tx.workRatingTag.createMany({data:tags.map(tagId=>({ratingId:rating.id,tagId}))});
    await tx.$executeRaw`UPDATE works SET rating=ROUND(((rating*rating_count)+${stars})/(rating_count+1),1), rating_count=rating_count+1, rating_dist=jsonb_set(rating_dist,${'{'||stars||'}'},to_jsonb((rating_dist->>${stars})::int+1)) WHERE id=${workId}`;
    return rating;
  });
}
```

---

## 文档完 — 执行守则再提醒

按阶段推进、测试全绿、写 PROGRESS、不省细节、schema 即契约。完成全部阶段后，本后端即满足「生产级、可对接前端原型」的要求。
