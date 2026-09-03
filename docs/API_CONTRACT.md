# Campus Market — API 契约（单一事实源）

> 这是前后端的**唯一事实源**。后端 `src/lib/zod/*` 的 schema、前端 `src/lib/api/*` 的调用、错误码处理，三方必须与本文件完全一致。任何字段/枚举/错误码的变更必须先改本文件。
> 前缀：`/api/v1`。生产/本地同前缀，前端同源调用（Next.js 全栈单项目）。

---

## 0. 总则

### 0.1 鉴权

- 除标注「公开」外，所有端点需登录（Auth.js JWT，httpOnly cookie，名为 `cm_token`，SameSite=Lax, Secure(https)）。
- 浏览器自动携带 cookie；接口不接受 query/body 传 token（防泄漏）。
- webhook（`/webhooks/*`）不用 cookie，改服务端验签。
- RBAC：`登录` = 任一已登录；`CREATOR` = 角色≥创作者且 `CreatorProfile.verified=true`；`ADMIN`。

### 0.2 请求与响应

- `Content-Type: application/json`（除上传 presigned 直传是二进制 PUT 到 S3）。
- 成功：`{ "data": ... }` 或 `{ "data": ..., "pagination": {...} }`。
- 列表分页：query `page`(从1) `pageSize`(默认20，最大50)；响应 `pagination: { page, pageSize, total, totalPages }`。
- 排序：`sort` 取值见各端点（`complex|hot|rate|new|price` 等）。
- 时间：ISO 8601 UTC 字符串。
- 金额：`string`（保留 2 位，如 `"9.90"`）—— 前端务必按字符串接收避免浮点误差。
- 评分均值：`string`（如 `"4.9"`）。

### 0.3 错误格式

```json
{ "error": { "code": "FORBIDDEN", "message": "无权操作", "details": { "field": "userId" } } }
```

HTTP 状态见 §2 错误码表。前端按 `code` 映射文案，`message` 仅作 fallback。

### 0.4 幂等

- 写操作（评分/收藏/关注/购买/下载）天然幂等或带约束：重复请求返回当前态而非报错（如重复收藏返回 `{favorited:true}`）。
- 支付回调用 `transactionId/idempotencyKey` 唯一约束。

---

## 1. 枚举字典（前后端共享常量）

```ts
// src/lib/constants.ts（前后端共用）
export const Role = { STUDENT: 'STUDENT', CREATOR: 'CREATOR', ADMIN: 'ADMIN' } as const;
export const WorkStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  PUBLISHED: 'PUBLISHED',
  REJECTED: 'REJECTED',
  TAKEN_DOWN: 'TAKEN_DOWN',
} as const;
export const Quality = { NORMAL: 'NORMAL', HIGH: 'HIGH', SELECTED: 'SELECTED' } as const;
export const FileType = {
  PDF: 'PDF',
  DOC: 'DOC',
  DOCX: 'DOCX',
  PPT: 'PPT',
  PPTX: 'PPTX',
  ZIP: 'ZIP',
  IMAGE: 'IMAGE',
  OTHER: 'OTHER',
} as const;
export const PayMethod = { WECHAT: 'WECHAT', ALIPAY: 'ALIPAY', MOCK: 'MOCK' } as const; // V6：下单仅 ALIPAY/MOCK；WECHAT 保留给提现(Payout)渠道
export const PayStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED',
  CLOSED: 'CLOSED',
  FAILED: 'FAILED',
} as const;
export const IncomeStatus = {
  PENDING: 'PENDING',
  SETTLED: 'SETTLED',
  WITHDRAWN: 'WITHDRAWN',
} as const;
export const PayoutStatus = {
  REQUESTED: 'REQUESTED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
} as const;
export const ReportReason = {
  INFRINGEMENT: 'INFRINGEMENT',
  PIRACY: 'PIRACY',
  MISMATCH: 'MISMATCH',
  PORN_GAMBLE_ILLEGAL: 'PORN_GAMBLE_ILLEGAL',
  SPAM: 'SPAM',
  OTHER: 'OTHER',
} as const;
export const ReportTargetType = { WORK: 'WORK', COMMENT: 'COMMENT', USER: 'USER' } as const;
export const NotificationType = {
  FOLLOW_NEW_WORK: 'FOLLOW_NEW_WORK',
  INCOME: 'INCOME',
  ARRIVED: 'ARRIVED',
  RATING_REPLIED: 'RATING_REPLIED',
  AUDIT_RESULT: 'AUDIT_RESULT',
  SYSTEM: 'SYSTEM',
} as const;
export const DynamicType = { PUBLISH: 'PUBLISH', UPDATE: 'UPDATE', CHECKIN: 'CHECKIN' } as const;
export const QualityBadge = { NORMAL: null, HIGH: '⭐', SELECTED: '🏅' } as const; // 前端徽标
```

---

## 2. 错误码表（统一）

| code                   | HTTP | 含义                        | 典型场景                   |
| ---------------------- | ---- | --------------------------- | -------------------------- |
| `UNAUTHENTICATED`      | 401  | 未登录                      | 无 cookie/会话失效         |
| `FORBIDDEN`            | 403  | 无权限                      | 越权改他人资源             |
| `NOT_FOUND`            | 404  | 资源不存在                  | 作品/创作者/订单           |
| `VALIDATION`           | 400  | 参数校验失败                | Zod 不通过，details 带字段 |
| `CONFLICT`             | 409  | 冲突                        | 已评价/已购买/重复         |
| `RATE_LIMITED`         | 429  | 限流                        | headers 含 `Retry-After`   |
| `NOT_EDU`              | 400  | 非深圳大学教育邮箱          | send-code/forgot-password  |
| `CODE_INVALID`         | 400  | 验证码错误                  | register/reset-password    |
| `CODE_EXPIRED`         | 400  | 验证码过期                  | register/reset-password    |
| `EMAIL_TAKEN`          | 409  | 邮箱已注册                  | register                   |
| `USERNAME_TAKEN`       | 409  | 用户名占用                  | register                   |
| `INVALID_CREDENTIAL`   | 401  | 邮箱或密码错误              | login（防枚举，统一文案）  |
| `WRONG_OLD_PASSWORD`   | 400  | 旧密码错误                  | change-password            |
| `ALREADY_CREATOR`      | 409  | 已是创作者                  | creator/apply              |
| `NO_RATING_ACCESS`     | 403  | 未购买/下载，无评分资格     | ratings create             |
| `ALREADY_RATED`        | 409  | 已评价                      | ratings create             |
| `PAYMENT_REQUIRED`     | 402  | 需付费且未购                | download(付费)             |
| `ORDER_CLOSED`         | 409  | 订单已关闭/过期             | pay                        |
| `INSUFFICIENT_BALANCE` | 400  | 可提现余额不足              | payout                     |
| `COPYRIGHT_REQUIRED`   | 400  | 未勾选版权声明              | works create/publish       |
| `FILE_TOO_LARGE`       | 413  | 文件超限                    | presign                    |
| `FILE_TYPE_DENIED`     | 415  | 文件类型不允许              | presign                    |
| `BAD_FILE`             | 400  | presign 后文件未上传/不匹配 | publish                    |
| `INTERNAL`             | 500  | 服务端错误                  | 兜底                       |

---

## 3. 共享数据类型（响应 schema，前后端共享）

> 定义在 `src/lib/zod/*`，前端 `import type` 复用。下为关键字段。

```ts
// 用户
AuthUser = {
  id, username, email, role:Role, avatarColor:string,
  student?: { school, college, major, grade, verifyStatus },
  creator?: { id, bio, direction, honor, verified:boolean } | null,
  unreadCount:number,
}

// 作品列表项
WorkListItem = {
  id, title, description, course, fileType, fileSize, pages:number,
  coverIcon, coverTheme, isFree:boolean, price:string, oldPrice:string|null,
  quality:Quality, status:WorkStatus,
  rating:string, ratingCount:number, downloads:number, favs:number, likes:number, views:string|number,
  tags:string[], author:{ id, username, avatarColor, verified:boolean },
  myFav?:boolean, myAccess?:boolean,
  publishedAt, updatedAt
}

// 作品详情
WorkDetail = WorkListItem & {
  previewToc:string[], applyMajor, applyGrade, applyCrowd,
  ratingDist:{"5":number,"4":number,"3":number,"2":number,"1":number},
  previewOnly:boolean,                  // 付费未购时 true（前端隐藏后续预览）
  myRating?: { stars:number, text:string } | null,
  author: CreatorSummary,               // 含 helped/fans/works/rate/honor/bio
}
CreatorSummary = { id, username, avatarColor, bio, direction, honor, college, major, verified,
                   helped:number, fans:number, works:number, rate:string, myFollow?:boolean }

// 评分评价
Rating = { id, stars:number, text, helpfulCount:number, creatorReply:string|null, repliedAt, createdAt,
           user:{ username, avatarColor }, tags:string[], _mine?:boolean }
RatingSummary = { rating:string, ratingCount:number, dist:RatingDist }

// 订单 / 支付
Order = { id, workId, buyerId, amount:string, payStatus:PayStatus, payMethod:PayMethod, paidAt, createdAt }
PayParams = // V6：支付宝跳转 {provider:'alipay', redirectUrl} | mock {provider:'mock', paid:true}（微信收款已下线）
CreateOrderResult = { orderId, pay:PayParams, access?:boolean }  // access=true 表示已有权限无需支付

// 下载
DownloadResult = { url:string, expiresIn:number }

// 创作者中心
CreatorOverview = { helped:number, income:{total:string,month:string,pending:string,withdrawable:string},
                     fans:number, avgRating:string, works:number, freeWorks:number, fineWorks:number }
WorkWithStats = WorkListItem & { status:WorkStatus, earnings:string }  // 含审核状态与收益
CreatorData = { works: Array<{ id,title,views,downloads,favs,rating:string,price:string,isFree,earnings:string }> }

// 收益
IncomeSummary = { total:string, month:string, pending:string, withdrawable:string }
IncomeTx = { id, workTitle:string, buyer:string, amount:string, method:PayMethod, createdAt, status:IncomeStatus }
Payout = { id, amount:string, method:PayMethod, status:PayoutStatus, requestedAt, completedAt:string|null, rejectedReason:string|null }

// 动态
Dynamic = { id, type:DynamicType, creator:CreatorSummary, work?:WorkListItem, createdAt }
Notification = { id, type:NotificationType, text:string, link:string|null, read:boolean, createdAt }
Report = { id, targetType:ReportTargetType, targetId, reason:ReportReason, detail:string|null, status:'OPEN'|'PROCESSING'|'RESOLVED', createdAt }
```

---

## 4. 端点契约（分组）

### 4.1 鉴权

| Method | Path                    | 鉴权 | 请求                                                        | 响应 data        | 错误                                                 |
| ------ | ----------------------- | ---- | ----------------------------------------------------------- | ---------------- | ---------------------------------------------------- |
| POST   | `/auth/send-code`       | 公开 | `{email}`                                                   | `{ok:true}`      | NOT_EDU/RATE_LIMITED/VALIDATION                      |
| POST   | `/auth/register`        | 公开 | `{email,code,username,password,school,college,major,grade}` | `AuthUser`       | CODE_INVALID/CODE_EXPIRED/EMAIL_TAKEN/USERNAME_TAKEN |
| POST   | `/auth/login`           | 公开 | `{email,password}`                                          | `AuthUser`       | INVALID_CREDENTIAL/RATE_LIMITED                      |
| POST   | `/auth/forgot-password` | 公开 | `{email}`                                                   | `{ok:true}`      | NOT_EDU/RATE_LIMITED/VALIDATION                      |
| POST   | `/auth/reset-password`  | 公开 | `{email,code,newPassword}`                                  | `{ok:true}`      | CODE_INVALID/CODE_EXPIRED/RATE_LIMITED/VALIDATION    |
| POST   | `/auth/change-password` | 登录 | `{oldPassword,newPassword}`                                 | `{ok:true}`      | WRONG_OLD_PASSWORD/RATE_LIMITED/UNAUTHENTICATED      |
| POST   | `/auth/logout`          | 登录 | —                                                           | `{ok:true}`      | —                                                    |
| GET    | `/auth/me`              | 登录 | —                                                           | `AuthUser`       | UNAUTHENTICATED                                      |
| POST   | `/me/creator/apply`     | 登录 | `{bio,direction,honor,studentCardKey?}`                     | `CreatorProfile` | ALREADY_CREATOR                                      |

### 4.2 作品

| Method | Path                      | 鉴权            | 请求        | 响应                               | 错误                                    |
| ------ | ------------------------- | --------------- | ----------- | ---------------------------------- | --------------------------------------- |
| GET    | `/works`                  | 公开            | query 见下  | `{data:WorkListItem[],pagination}` | VALIDATION                              |
| GET    | `/works/:id`              | 公开(带session) | —           | `WorkDetail`                       | NOT_FOUND                               |
| POST   | `/works`                  | CREATOR         | `WorkInput` | `Work(DRAFT)`                      | COPYRIGHT_REQUIRED/VALIDATION/FORBIDDEN |
| PUT    | `/works/:id`              | owner           | `WorkInput` | `Work`                             | FORBIDDEN/CONFLICT                      |
| POST   | `/works/:id/publish`      | owner           | —           | `Work(PENDING)`                    | BAD_FILE/FORBIDDEN                      |
| DELETE | `/works/:id`              | owner/admin     | —           | `{ok}`                             | FORBIDDEN                               |
| GET    | `/works/:id/related`      | 公开            | —           | `WorkListItem[]`                   | —                                       |
| GET    | `/works/:id/ratings`      | 公开            | `sort=new   | helpful                            | high                                    | low`,page | `{data:Rating[],pagination,summary:RatingSummary}` | —   |
| GET    | `/works/:id/ratings/tags` | 公开            | —           | `{pos:string[],neg:string[]}`      | —                                       |

**`/works` query**：`page,pageSize,creatorId,isFree:boolean,quality:Quality,fileType:FileType,minRating:number,updatedSince:ISO,course,tag,sort=complex|hot|rate|new|price`

**`WorkInput`**：`{ title:string(≤120), description:string(≤800), course:string, fileType:FileType, fileKey:string, fileSize:int(≤209715200), pages?:int, coverIcon?:string, coverTheme?:string, isFree:boolean, price?:string, oldPrice?:string, applyMajor?, applyGrade?, applyCrowd?, tags:string[](≤5), previewToc:string[], copyrightAccepted:boolean }`

### 4.3 评分评价

| Method | Path                    | 鉴权           | 请求                                                  | 响应                                       | 错误                                      |
| ------ | ----------------------- | -------------- | ----------------------------------------------------- | ------------------------------------------ | ----------------------------------------- |
| POST   | `/works/:id/ratings`    | 登录+hasAccess | `{stars:int(1-5),text:string(≥5,≤600),tags:string[]}` | `Rating`(201)                              | NO_RATING_ACCESS/ALREADY_RATED/VALIDATION |
| POST   | `/ratings/:rid/helpful` | 登录           | —                                                     | `{helpfulCount}`                           | —                                         |
| POST   | `/ratings/:rid/reply`   | 该作品作者     | `{text}`                                              | `Rating`                                   | FORBIDDEN                                 |
| GET    | `/me/ratings`           | 登录           | —                                                     | `Array<Rating & {work:{id,title,course}}>` | —                                         |

### 4.4 交易/支付/下载

| Method | Path               | 鉴权        | 请求                    | 响应                | 错误                             |
| ------ | ------------------ | ----------- | ----------------------- | ------------------- | -------------------------------- |
| POST   | `/works/:id/order` | 登录        | `{payMethod:PayMethod}` | `CreateOrderResult` | PAYMENT_REQUIRED(免费?)/CONFLICT |
| POST   | `/orders/:id/pay`  | 登录(owner) | —                       | `{pay:PayParams}`   | ORDER_CLOSED/FORBIDDEN           |
| GET    | `/orders/:id`      | 登录(owner) | —                       | `Order`             | FORBIDDEN/NOT_FOUND              |

| GET | `/webhooks/pay/epay` | MD5 验签 | (码支付 query) | `success`(text) | — |
| POST | `/works/:id/download` | 登录+hasAccess | — | `DownloadResult` | PAYMENT_REQUIRED/FORBIDDEN |

### 4.5 社交

| Method | Path                   | 鉴权 | 响应                               |
| ------ | ---------------------- | ---- | ---------------------------------- |
| POST   | `/works/:id/favorite`  | 登录 | `{favorited:true, favs:number}`    |
| DELETE | `/works/:id/favorite`  | 登录 | `{favorited:false, favs:number}`   |
| POST   | `/works/:id/like`      | 登录 | `{liked:true, likes:number}`       |
| DELETE | `/works/:id/like`      | 登录 | `{liked:false, likes:number}`      |
| POST   | `/creators/:id/follow` | 登录 | `{followed:true, fans:number}`     |
| DELETE | `/creators/:id/follow` | 登录 | `{followed:false, fans:number}`    |
| GET    | `/me/following/feed`   | 登录 | `Dynamic[]`                        |
| GET    | `/me/favorites`        | 登录 | `{data:WorkListItem[],pagination}` |
| GET    | `/creators/:id`        | 公开 | `CreatorDetail(含 myFollow)`       |
| GET    | `/creators/:id/works`  | 公开 | `WorkListItem[]`（filter=free      | fine | hot） |
| GET    | `/creators/:id/stats`  | 公开 | `{helped,fans,works,avgRating}`    |

### 4.6 我的 / 创作者中心 / 收益

| Method | Path                         | 鉴权    | 响应                                          |
| ------ | ---------------------------- | ------- | --------------------------------------------- |
| GET    | `/me/library`                | 登录    | `LibraryItem[]`（filter=all                   | bought | download | fav | todo | rated） |
| GET    | `/me/orders`                 | 登录    | `Order[]`                                     |
| GET    | `/me/notifications`          | 登录    | `Notification[]`                              |
| POST   | `/me/notifications/read-all` | 登录    | `{ok}`                                        |
| GET    | `/me/creator/overview`       | CREATOR | `CreatorOverview`                             |
| GET    | `/me/creator/works`          | CREATOR | `WorkWithStats[]`                             |
| GET    | `/me/creator/data`           | CREATOR | `CreatorData`                                 |
| GET    | `/me/income/summary`         | CREATOR | `IncomeSummary`                               |
| GET    | `/me/income/transactions`    | CREATOR | `IncomeTx[]`                                  |
| POST   | `/me/income/payout`          | CREATOR | `{amount:string,method:PayMethod}` → `Payout` |
| GET    | `/me/income/payouts`         | CREATOR | `Payout[]`                                    |

> `POST /me/income/payout` 错误：`INSUFFICIENT_BALANCE` / `VALIDATION`（amount≤0）。

### 4.7 搜索 / 排行 / 上传 / 举报 / 通知 / 管理

| Method | Path                        | 鉴权    | 请求/响应                                                                                       |
| ------ | --------------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| GET    | `/search`                   | 公开    | `q,type=all                                                                                     | works                                           | creator   | line                                              | guide | fine,filters,sort`→`{works:WorkListItem[],creators:CreatorSummary[],total:number}` |
| GET    | `/ranks/:type`              | 公开    | type=help                                                                                       | rate                                            | fav       | creator → `Array<{rank,entity}>`（entity 视类型） |
| POST   | `/uploads/presign`          | CREATOR | `{fileType,fileSize,sha}` → `{fileKey,putUrl,headers?}`（错误 FILE_TOO_LARGE/FILE_TYPE_DENIED） |
| GET    | `/notifications`            | 登录    | 同 me/notifications                                                                             |
| POST   | `/reports`                  | 登录    | `{targetType,targetId,reason,detail?}` → `Report`                                               |
| GET    | `/admin/works/pending`      | ADMIN   | `WorkWithStats[]`                                                                               |
| POST   | `/admin/works/:id/audit`    | ADMIN   | `{action:APPROVE                                                                                | REJECT                                          | TAKE_DOWN | REQUEST_CHANGES,note?}`→`Work`                    |
| GET    | `/admin/reports`            | ADMIN   | `Report[]`                                                                                      |
| POST   | `/admin/reports/:id`        | ADMIN   | `{status,note?}` → `Report`                                                                     |
| POST   | `/admin/payouts/:id`        | ADMIN   | `{action:complete                                                                               | reject,channelTxId?,rejectionReason?}`→`Payout` |
| POST   | `/admin/creators/:id/audit` | ADMIN   | `{approve:boolean}` → `CreatorProfile`                                                          |

---

## 5. 前后端一致性约束（强制）

1. 所有金额以**字符串**传输（`"9.90"`），前端展示用 `formatCny`，运算后端做。
2. 枚举值大写英文，前端常量从 `src/lib/constants.ts` 引用，禁止硬编码。
3. 列表统一 `data+pagination`，前端 `TanStack Query` 的 `getNextPageParam` 用 `pagination.page < totalPages`。
4. 时间统一 ISO，前端 `dayjs` 相对化（"2 小时前"）。
5. 错误统一走 `code`；前端 `apiFetch` 抛 `ApiError{code,message,details}`，UI 层按 code 映射文案，`UNAUTHENTICATED` → 跳登录。
6. 任何新增端点/字段必须先改本文件 → 再改后端 zod → 再改前端调用，PR 检查清单含「契约一致」。

---

## 6. 版本三变更（V3，2026-08-28）

> 本节为增量记录，与上文冲突处以本节为准。

### 6.1 枚举与权限

- 新增枚举 `Category`：`COURSE|EXAM|CAREER|TUTOR|LIFE|CAMPUS`（用途大类）；`Work.category` 默认 `COURSE`。
- `ReportStatus` 新增 `DISMISSED`（驳回）；`ReportTargetType` 新增 `RATING`（评价举报）。
- **发布权限开放（决策）**：`CREATOR` 门槛从「CreatorProfile.verified=true」降为「登录即可」（`ensurePublisher` 自动创建未认证档案并升级角色）；verified 仅作认证徽章。`/uploads/presign`、`POST /works`、`POST /works/:id/publish`、`/me/creator/*`、`/me/income/*` 均按此执行。
- `Work.views` 语义变更：**在线预览打开次数**（登录按 userId / 匿名按 IP，24h 去重）；详情页读取不再计数。

### 6.2 新增端点

| 方法        | 路径                                                 | 权限                                  | 说明                                                                                                                                                     |
| ----------- | ---------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET         | `/works/courses?category=`                           | 公开                                  | 大类下热门课程聚合 `[{course,count}]`（缓存 60s）                                                                                                        |
| POST        | `/works/:id/preview`                                 | **匿名可访问**（middleware 单独放行） | `{mode:'full'                                                                                                                                            | 'sample'                                                                                                              | 'none', url, pages, hasPreview}`；免费/已购/作者→full 原文件；付费未购→sample（previewKey 5 页试读副本）；非 PDF→none。打开即计观看（去重）。限流 30/min |
| GET         | `/works/:id/cover`                                   | 公开                                  | 302 → 封面图内联签名 URL（1h），`Cache-Control: public, max-age=3600`；无 coverKey→404（前端回退 emoji）                                                 |
| GET         | `/users/:id`                                         | 公开                                  | 用户主页：`{username,avatarColor,hasAvatar,bio,direction,honor,college,major,grade,verified,isCreator,helped,fans,following,works,rate,myFollow,isSelf}` |
| GET         | `/users/:id/works?filter=`                           | 公开                                  | 同原 `/creators/:id/works`                                                                                                                               |
| GET         | `/users/:id/ratings`                                 | 公开                                  | TA 的公开评价历史（含 work 摘要）                                                                                                                        |
| GET         | `/users/:id/follows?type=following\|followers&page=` | 公开                                  | 行卡：`[{id,username,avatarColor,hasAvatar,bio,college,verified,fans,myFollow,isSelf}]`                                                                  |
| POST/DELETE | `/users/:id/follow`                                  | 登录                                  | 同原 `/creators/:id/follow`                                                                                                                              |
| GET         | `/users/:id/avatar`                                  | 公开                                  | 302 头像（同 cover 模式）                                                                                                                                |
| PATCH       | `/me/profile`                                        | 登录                                  | `{username?,bio?,college?,grade?,major?}`；username 查重→USERNAME_TAKEN                                                                                  |
| POST        | `/me/avatar`                                         | 登录                                  | `{avatarKey}`（先 presign kind=avatar 直传）；校验对象存在                                                                                               |
| GET         | `/me/reports`                                        | 登录                                  | 我的举报（含 statusLabel/handleNote）                                                                                                                    |
| POST        | `/admin/reports/handle`                              | ADMIN                                 | 按 target 批量处置：`{targetType,targetId,action:'RESOLVE'                                                                                               | 'DISMISS',note?,measures?:{takedownWork?,deleteComment?,banUser?,banReason?}}`；RESOLVE 联动下架/删评/封号 + 双向通知 |

### 6.3 修改端点

- `GET /works` query 新增 `category`；`WorkListItem` 新增 `category`、`hasCover`；详情新增 `hasSample`（付费且有试读副本）。
- `POST /uploads/presign` 入参新增 `kind`（`work|cover|avatar|preview`，默认 work）：cover/avatar 仅 IMAGE ≤5MB（covers/、avatars/ 前缀），preview 仅 PDF ≤30MB（previews/ 前缀）。
- `POST /works` 入参新增 `category/coverKey/previewKey`。
- `POST /reports`：同人同目标存在未结单 → `CONFLICT 409`；创建时生成内容快照（targetTitle/targetSnapshot/targetAuthorId）。
- `GET /admin/reports`：改为**按 target 聚合** `{data:[{targetType,targetId,targetTitle,snapshot,count,reporters:[{username,reason,detail,at}],reasons,latestAt,openCount,status}],total}`，支持 `?status=` 过滤；旧 `/admin/reports/:id` 已删除。

### 6.4 删除端点

- `/creators/:id`、`/creators/:id/stats`、`/creators/:id/works`、`/creators/:id/follow`（迁移至 `/users/*`）。

### 6.5 前端路由变更

- 新增 `/explore`（分类浏览：cat/tag/course/sort/price 组合）、`/user/[id]`（个人主页，本人 10 tab / 他人 4 tab）。
- `/me`、`/creator/[id]`、`/creator-center`、`/income` 全部重定向至 `/user/[id]` 对应 tab。

---

## 7. 版本四变更（V4，2026-09-01）：运维控制台 / 公告 / 学习路线图

> 本节为增量记录，与上文冲突处以本节为准。

### 7.1 枚举与常量

- 新增枚举 `AnnounceLevel`：`NORMAL|IMPORTANT`；`RoadmapCategory`：`BACKEND|FRONTEND|AI|ALGORITHM|EXAM|OTHER`。
- `AuditAction` 新增 `DELETE`（管理员删除资料的审计动作）。
- `NotificationType.AUDIT_RESULT` 正式启用：作品与路线图审核结果通知作者（此前闲置）。
- `AuthUser` 响应新增 `unreadAnnouncements: number`（顶栏公告红点）。

### 7.2 新增端点 — 公告

| 方法   | 路径                       | 权限  | 说明                                                                                         |
| ------ | -------------------------- | ----- | -------------------------------------------------------------------------------------------- |
| GET    | `/announcements`           | 公开  | `?page&pageSize&unread=true`；未登录带 unread 返回空列表；`{data:Announcement[],pagination}` |
| POST   | `/announcements/read-all`  | 登录  | 全部标记已读（createMany skipDuplicates）→ `{read:n}`                                        |
| GET    | `/admin/announcements`     | ADMIN | 管理列表（含已撤回）                                                                         |
| POST   | `/admin/announcements`     | ADMIN | `{title≤120,content≤5000,level}`；content 入库前 sanitize                                    |
| DELETE | `/admin/announcements/:id` | ADMIN | 撤回（软删 deletedAt）                                                                       |

### 7.3 新增端点 — 运维控制台配套

| 方法 | 路径               | 权限  | 说明                                                            |
| ---- | ------------------ | ----- | --------------------------------------------------------------- |
| GET  | `/admin/users/:id` | ADMIN | 用户详情聚合（student/creator/\_count/钱包余额/封禁信息）       |
| GET  | `/admin/works`     | ADMIN | 全量资料列表 `?page&pageSize&q&status&authorId`（直查不走缓存） |
| GET  | `/admin/orders`    | ADMIN | 订单列表 `?page&pageSize&payStatus&q`（只读）                   |

- `GET /admin/users` 响应字段扩展（SAFE_SELECT 增加 avatarKey/bannedAt/bannedReason）。
- `DELETE /works/:id`：ADMIN 删除时事务内写 AuditLog（action=DELETE, note=reason 可选）；请求体可带 `{reason}`。

### 7.4 新增端点 — 学习路线图

| 方法        | 路径                        | 权限              | 说明                                                                                                                                                                                                      |
| ----------- | --------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET         | `/roadmaps`                 | 公开              | `?page&pageSize&category&sort=favs\|newest` → `{data:RoadmapListItem[],pagination}`（仅 PUBLISHED）                                                                                                       |
| GET         | `/roadmaps/:id`             | 公开              | 详情含 `content:{phases}`、关联 `works:WorkListItem[]`、`myFav`；PENDING/REJECTED 仅上传者与 ADMIN                                                                                                        |
| POST        | `/roadmaps`                 | 登录（限流 5/h）  | `{title,summary,category,coverIcon?,mdSourceKey,workIds≤10,credentialKey?,experience?}`；ADMIN→直接 PUBLISHED，普通用户→PENDING 且学生证+经历必填；服务端从 MinIO 拉取 md 重新解析校验（≥1 阶段且 ≥3 步） |
| POST/DELETE | `/roadmaps/:id/favorite`    | 登录              | 幂等 set，同 works favorite 模式 → `{favorited,favs}`                                                                                                                                                     |
| GET         | `/me/roadmap-favorites`     | 登录              | 我收藏的路线图（仅 PUBLISHED）→ `{data:RoadmapListItem[],pagination}`；个人主页收藏 tab 与资料收藏分组展示                                                                                                |
| POST        | `/roadmaps/:id/check`       | 登录（限流 60/m） | `{stepId,checked}`；服务端校验 stepId 属于该路线图；勾选=打卡                                                                                                                                             |
| GET         | `/roadmaps/:id/progress`    | 登录              | `{checked:[{stepId,createdAt}],byDay:{'YYYY-MM-DD':n},streakDays,totalChecked,stepsCount}`；**日界 UTC+8**                                                                                                |
| GET         | `/admin/roadmaps/pending`   | ADMIN             | 待审列表（含 hasCredential）                                                                                                                                                                              |
| GET         | `/admin/roadmaps/:id`       | ADMIN             | 审核详情：content + credentialUrl（presign 图）+ mdUrl（下载）+ works                                                                                                                                     |
| POST        | `/admin/roadmaps/:id/audit` | ADMIN             | `{action:APPROVE\|REJECT,note?}`；审核留痕 reviewerId/reviewedAt；通知上传者（AUDIT_RESULT）                                                                                                              |

### 7.5 修改端点

- `POST /uploads/presign` kind 扩展：`roadmap`（roadmaps/ 前缀，OTHER 类型伪装，contentType text/markdown，≤2MB，扩展名 .md）、`credential`（credentials/ 前缀，IMAGE ≤5MB）。
- `POST /auth/login` / requireUser：封禁文案携带原因 `账号已被封禁：{bannedReason}`。
- `POST /admin/works/:id/audit`：APPROVE/REJECT/TAKE_DOWN 均新增作者通知（此前只有粉丝通知）。

### 7.6 前端路由与数据模型

- 新增页面：`/announcements`（公告中心，管理员可发布/撤回）、`/ops/users(/:id)`、`/ops/works`、`/ops/orders`、`/roadmaps(/upload)`、`/roadmaps/[id]`（todolist 打卡 + 热力图）。
- `/ops` 业务概览五卡可点入详情页；`/admin` 支持 `?tab=` 深链，tab 调整为：资料审核 / 路线图审核 / 公告管理 / 举报队列 / 提现审批 / 创作者认证 / 用户管理。
- 顶栏：搜索框占满剩余宽度；新增「公告」入口（未读红点）。
- 新表：`announcements` / `announcement_reads` / `roadmaps` / `roadmap_work_links` / `roadmap_favorites` / `roadmap_checks`（详见 prisma/schema.prisma）。

### 7.7 已知修复

- `tests/setup.ts`：显式将 `DATABASE_URL_POOLED` 指向测试库（此前集成测试经 PgBouncer 误连开发库，flushDb 会清空 dev 数据）。

## 8. 版本五变更（V5，2026-09-02）：注册开放 + 邮箱登录补全

### 8.1 新增端点

见 §4.1：`/auth/forgot-password`（发重置码）、`/auth/reset-password`（码+新密码重置）、`/auth/change-password`（登录态改密）。

### 8.2 语义与机制变更

- **验证码 purpose 化**：Redis key `verify:email:{email}` → `verify:{register|reset}:email:{email}`，注册码与重置码隔离（防跨流程混用）。
- **pwdVersion 会话失效**：`users.pwdVersion`（默认 0）+ JWT `pwdVer` claim；改密/重置后 `pwdVersion` 原子自增，`requireUser` 比对不一致 → 401「登录已过期」，即改密后全端下线。老 JWT 无 claim 视为 0，存量会话不受影响。
- **注册邮箱收紧**：`EDU_EMAIL_REGEX` 默认值改为 `^[^@]+@([a-zA-Z0-9-]+\.)*szu\.edu\.cn$`（szu.edu.cn 及任意级子域，如 mails.szu.edu.cn）；仅影响发码入口，存量用户登录不受影响。
- **防枚举**：forgot-password 对未注册邮箱同样返回 `{ok:true}` 但不存码不发信。
- **防爆破**：reset-password 每邮箱尝试 10 次/小时（`RL_RESET_TRY_PER_HOUR`），错码不删 key 但消耗尝试次数。
- 新增错误码 `WRONG_OLD_PASSWORD`；`NOT_EDU` 含义改为「非深圳大学教育邮箱」。
- 删除无引用的 `verification_tokens` 表（Auth.js 备用残留）。

## 10. 版本六变更（V6，2026-09-03）：码支付网关接入（仅支付宝）

- `PAYMENT_MODE` 取值收窄为 `mock | epay`；下单仅接受 `payMethod: ALIPAY | MOCK`（WECHAT → VALIDATION）。微信收款整体下线（`webhooks/pay/wechat`、`/webhooks/pay/alipay` 路由删除，新回调 `GET /webhooks/pay/epay`）。PayMethod 常量保留 WECHAT 供提现链路（Payout）使用。
- `PayParams` 删除微信形态；支付宝 = 码支付 mapi.php 返回的 `payurl` 跳转。
- `markPaid` 新增金额校验（回调 `money` 与订单 `amount` 差 ≥0.005 元拒绝）；CLOSED 订单收到**已验签且金额相符**的回调允许重开结算（防超时关单后买家完成付款导致资金悬空）；重复流水的第二笔回调幂等吞掉并告警日志。
- `GET /orders/:id` 在订单 PENDING 时每 10s 向网关兜底查单一次（notify 丢失自愈）。
- 退款：码支付无退款 API，`refund` 在 epay 通道直接报错（商户后台人工处理）；mock 通道保留（测试用）。
