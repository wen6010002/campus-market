# Campus Market — 前端开发文档

> **给 Claude Code 的执行守则（先读）**
>
> 1. 本项目与后端在同一 Next.js 仓库（见 `BACKEND.md`）。前端 = Next.js App Router 的 React 页面，严格仿照高保真原型 `../campus-market-v3/*.html` + `assets/style.css` + `assets/app.js`。
> 2. **视觉与交互以原型为唯一真相**：页面布局、组件类名、文案、状态、动效、交互闭环都要与原型一一对照；颜色/圆角/间距不得自行发挥。
> 3. **数据与字段以后端为准**：调 `/api/v1/*`，类型从 `API_CONTRACT.md` 的 Zod 推导；金额是字符串、枚举大写英文、列表 `data+pagination`。
> 4. 不引入 UI 组件库（antd/MUI/shadcn 等会破坏原型视觉）；只用原型 `style.css` 迁移来的类 + 少量必要 headless 原语（如 `@radix-ui/react-dialog` 可选，否则自写 modal，原型已有 `.modal` 样式）。
> 5. 每阶段完成后跑组件测试 + 对应 E2E，全绿再进下一阶段，写 `docs/PROGRESS.md`。

---

## 1. 项目总览 + 与原型对应

### 1.1 定位

把原型 9 个静态/`localStorage` 页面升级为**真实全栈应用的前端**：React 组件化 + 真实 API + 鉴权 + 文件直传 + 支付拉起 + 全局状态联动。视觉、信息层级、交互闭环**与原型保持一致**（首页第一屏不出现价格、精品下移弱化、评分体系、创作者经济飞轮、信任/治理层）。

### 1.2 原型 → 前端路由映射（严格一一对照）

| 原型文件                   | Next.js 路由              | 关键 query/tab                            |
| -------------------------- | ------------------------- | ----------------------------------------- |
| `index.html`               | `/` (app/(site)/page.tsx) | —                                         |
| `work.html?id=`            | `/work/[id]`              | —                                         |
| `creator.html?id=`         | `/creator/[id]`           | —                                         |
| `following.html`           | `/following`              | —                                         |
| `search.html?q=&tab=`      | `/search`                 | `?q=&type=&...`                           |
| `profile.html?tab=`        | `/me`                     | `?tab=library                             | favs         | orders    | ratings | notif` |
| `upload.html`              | `/upload`                 | —                                         |
| `creator-center.html?tab=` | `/creator-center`         | `?tab=overview                            | works        | data`     |
| `income.html?tab=`         | `/income`                 | `?tab=summary                             | transactions | withdraw` |
| （新增）`index.html`/无    | `/login`, `/register`     | 鉴权页（原型在 dropdown，需新增独立页）   |
| （新增）                   | `/admin`                  | 审核/举报/提现审批（原型无，按 API 实现） |

### 1.3 "严格仿照"判定标准（验收）

- 每个原型 class（`.work-card/.fine-card/.creator/.dyn-card/.rank-item/.modal/.review-section/.preview-box/.cr-hero-bar/...`）在前端有同名 className 还原。
- 文案逐字一致（如「不是资料下载站，而是大学生成长平台」「以帮助同学为荣 · 非销量榜」「分享知识 → 帮助同学 → 获得影响力 → 获得收益」）。
- 交互闭环一致：7 条核心路径（见 §8）行为与原型相同（含乐观更新、状态切换、空态、错误提示）。
- 视觉 token 一致：橙 `#FF6B4A`、薄荷 `#10B981`、精品 `#D04A2A`、白底、轻阴影、小圆角、卡片、无大渐变/玻璃拟态。

---

## 2. 技术栈与目录结构

### 2.1 技术栈

- Next.js 14 App Router（同后端仓库）· TypeScript(strict)
- TanStack Query v5（服务端状态/缓存/乐观更新/无限滚动）
- Zustand（纯客户端态：UI step、stepper、upload 临时态）
- React Hook Form + Zod（表单 + 与后端同 schema）
- dayjs（相对时间）、DOMPurify（富文本展示评价，防 XSS）
- next/font（Plus Jakarta Sans + Noto Sans SC，与原型一致）
- **复用原型 CSS**（见 §3）
- Testing Library + Playwright（E2E）

### 2.2 目录结构

```
src/
├── app/
│   ├── (site)/                 # 仿原型页面
│   │   ├── layout.tsx          # 顶部 nav + footer（对应原型 navHost/footHost 的 mountChrome）
│   │   ├── page.tsx            # 首页
│   │   ├── work/[id]/page.tsx
│   │   ├── creator/[id]/page.tsx
│   │   ├── following/page.tsx
│   │   ├── search/page.tsx
│   │   ├── me/page.tsx         # 个人中心(5 Tab)
│   │   ├── upload/page.tsx
│   │   ├── creator-center/page.tsx
│   │   ├── income/page.tsx
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (admin)/admin/...       # 管理后台（按 API）
│   └── api/v1/...              # 后端路由（见 BACKEND.md）
├── components/
│   ├── chrome/                 # Nav.tsx / Footer.tsx / AvatarDropdown.tsx / SearchBox.tsx（对应原型 nav 区）
│   ├── work/                   # WorkCard.tsx(.work-card) / FineCard.tsx / WorkDetailLayout.tsx / RatingBars.tsx / ReviewItem.tsx / ActionButtons.tsx
│   ├── creator/                # CreatorCard.tsx / CreatorHero.tsx / DynamicCard.tsx(.dyn-card)
│   ├── rank/                   # RankList.tsx / RankItem.tsx
│   ├── common/                 # Modal.tsx(.modal) / Toast.tsx(.toast) / Stars.tsx / Empty.tsx / Tabs.tsx / Stepper.tsx / StatCard.tsx / Tag/Chip.tsx
│   └── form/                   # RatingModal.tsx / OrderModal.tsx / ReportModal.tsx / WithdrawModal.tsx
├── hooks/                      # TanStack Query hooks
│   ├── useAuth.ts
│   ├── useWorks.ts
│   ├── useWork.ts
│   ├── useRatings.ts
│   ├── useOrder.ts
│   ├── useFavorite.ts useFollow.ts useLike.ts
│   ├── useCreator.ts
│   ├── useLibrary.ts useNotifications.ts
│   ├── useIncome.ts useCreatorCenter.ts
│   ├── useSearch.ts useRank.ts
│   └── useUpload.ts
├── lib/
│   ├── api/
│   │   ├── client.ts           # apiFetch 封装
│   │   ├── errors.ts           # ApiError + code→文案
│   │   └── endpoints.ts        # 类型化端点函数
│   ├── constants.ts            # 与后端共享枚举
│   ├── format.ts               # formatCny/formatNum/timeAgo
│   └── icons.tsx               # 原型内联 SVG 提取
├── stores/
│   ├── ui.ts                   # stepper / modal open / toast
│   └── upload.ts               # 发布流程临时态
└── styles/
    └── globals.css             # 原型 style.css 迁移（见 §3）
```

---

## 3. 设计系统迁移（原型 CSS → 前端）

### 3.1 迁移策略

把原型 `assets/style.css`（~700 行）**整体复制**为 `src/styles/globals.css`，在 `app/layout.tsx` 用 `import '@/styles/globals.css'` 引入（全局）。**不重写、不换 token**，保证像素一致。

- `:root` 设计变量（`--pri:#FF6B4A`、`--mint`、`--fine`、`--ink*`、`--line*`、`--shadow*`、`--r*`、`--maxw`、字体）原样保留。
- 所有组件类（`.nav/.toolbar/.work-card/.fine-card/.creator/.dyn-card/.rank-item/.topics-grid/.zone/.modal/.toast/.review-section/.rating-dist/.cr-hero-bar/.user-layout/.side-card/.stat-card/.ach-grid/.preview-box/.stepper/.dropzone/...`）原样保留。
- 学科封面 `.g-db/.g-java/.g-ai/...` 保留（作品封面 emoji + 渐变背景）。
- 响应式 `@media` 保留。
- `next/font` 注入 `--font` 变量，覆盖原型 Google Fonts `<link>`（避免外网依赖，支持自托管）。

### 3.2 组件类名映射（React 组件 ↔ 原型 class）

| React 组件           | 顶层 className（原型）                | 备注                                                               |
| -------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| `<WorkCard/>`        | `.work-card`                          | 含 `.work-cover/.work-body/.work-stats/.work-foot`                 |
| `<FineCard/>`        | `.fine-card`                          | `.fine-cover/.fine-body/.fine-foot`                                |
| `<CreatorCard/>`     | `.creator`                            | `.cr-av/.cr-stats/.cr-follow`                                      |
| `<DynamicCard/>`     | `.dyn-card`                           | `.dh-head/.dh-work/.dh-foot`                                       |
| `<RankItem/>`        | `.rank-item`                          | `.rank-no/.rank-av/.rank-metric`                                   |
| `<Stars/>`           | `.stars`                              | 生成 `.s-on/.s-off` svg                                            |
| `<RatingBars/>`      | `.rating-dist`                        | `.rd-row/.bar`                                                     |
| `<ReviewItem/>`      | `.review-item`                        | `.review-top/.review-text/.review-tags/.review-foot/.review-reply` |
| `<Modal/>`           | `.modal-mask/.modal`                  | `.modal-head/.modal-body/.modal-foot`                              |
| `<Toast/>`           | `.toast-wrap/.toast`                  | 全局 Provider                                                      |
| `<StatCard/>`        | `.stat-card`                          | `.lb/.v/.delta/.ic`                                                |
| `<Tabs/>`            | `.tabs/.tab-btn`                      | 受控 active                                                        |
| `<Stepper/>`         | `.stepper/.step/.step-dot/.step-line` | 发布流程                                                           |
| `<Dropzone/>`        | `.dropzone`                           | presign 上传                                                       |
| `<Nav/>`/`<Footer/>` | `.nav/.nav-inner/.foot-*`             | chrome                                                             |

> 组件实现 = 原型 HTML 片段 → JSX（class → className），数据由 props/Query 提供，文案保持原型。

---

## 4. API 客户端 + TanStack Query 策略

### 4.1 `lib/api/client.ts`

```ts
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    public details?: any,
  ) {
    super(message);
  }
}
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok)
    throw new ApiError(
      json?.error?.code ?? 'INTERNAL',
      res.status,
      json?.error?.message ?? '请求失败',
      json?.error?.details,
    );
  return json.data as T;
}
```

- 错误码→文案表 `lib/api/errors.ts`（如 `NO_RATING_ACCESS → '只有下载或购买过的同学才能评价'`、`INSUFFICIENT_BALANCE → '可提现余额不足'`、`UNAUTHENTICATED → '请先登录'`）。
- 全局 `Toast` 监听 `ApiError` 显示文案；`UNAUTHENTICATED` → 跳 `/login?from=...`。

### 4.2 Query 全局配置（`app/providers.tsx`）

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (c, err) =>
        err instanceof ApiError && err.status >= 400 && err.status < 500 ? false : c < 2,
    },
  },
});
```

- 缓存键约定：`['works','list',params]`、`['works','detail',id]`、`['me']`、`['favorites']` 等。
- 列表用 `useInfiniteQuery`，`getNextPageParam: last => last.pagination.page<last.pagination.totalPages ? last.pagination.page+1 : undefined`。

### 4.3 乐观更新模板（收藏/关注/点赞/评分）

```ts
// useFavorite(workId)
const qc = useQueryClient();
return useMutation({
  mutationFn: async (fav:boolean)=> apiFetch(`/works/${workId}/favorite`, fav?{method:'POST'}:{method:'DELETE'}),
  onMutate: async (fav)=>{
    await qc.cancelQueries({queryKey:['works','detail',workId]});
    const prev = qc.getQueryData<WorkDetail>(['works','detail',workId]);
    qc.setQueryData<WorkDetail>(['works','detail',workId], old => old && {...old, myFav:fav, favs:old.favs+(fav?1:-1)});
    // 列表项同步：遍历 ['works','list'] 缓存更新该 work
    return { prev };
  },
  onError:(e,_v,ctx)=>{ if(ctx?.prev) qc.setQueryData(['works','detail',workId], ctx.prev); toast.error(...) },
  onSettled:()=>{ qc.invalidateQueries({queryKey:['works','detail',workId]}); qc.invalidateQueries({queryKey:['me','favorites']}); },
});
```

- 关注：失效 `['creators','detail',id]` + 首页创作者卡 + `['me','following']`；通知计数刷新。
- 评分：成功后失效 `['works','detail',id]`（重算均值/分布回填）+ `['works',id,'ratings']` + `['me','ratings']`。

---

## 5. 逐页实现（每页：原型/路由/组件/接口/状态/还原点）

> 通用：每页 `Page` 用 Query 取数 → 渲染组件；`<Nav/>`+`<Footer/>` 在 `(site)/layout.tsx`（对应原型 mountChrome，但 logo 跳 `/`、搜索回车跳 `/search?q=`、发布按钮跳 `/upload`、dropdown 项跳各页、未读红点来自 `['me']` 的 unreadCount）。

### 5.1 首页 `/`（原型 `index.html`）

- 信息层级与原型一致：搜索 → 关注动态（如未关注显示引导）→ 今日免费推荐 → 优秀创作者 → 专题 → 学习专区 → 猜你喜欢 → 精品 → 排行榜 → 成长路线。**第一屏无价格**，精品价格弱化右下角小字。
- 接口：`GET /works?isFree=true&sort=hot`(免费)、`GET /ranks/help`(榜单)、`GET /creators?...`(创作者，或复用 ranks/creator)、`GET /me/following/feed`(动态，未登录/未关注显示空态引导)、猜你喜欢 `GET /works?sort=complex&pageSize=8` + 「换一批」改 queryKey 偏移。
- 组件：`<DynRail/>`、`<WorkCard/>` 网格(`.card-grid` column-count)、`<CreatorCard/>`、专题静态、学习专区静态(跳搜索)、`<FineCard/>`、`<RankList/>`（Tab 切 help/rate/fav/creator）。
- 还原点：子导航 sticky 滚动高亮、分区 Tab(campus/grow) 切换、关注/收藏/点赞乐观更新、卡片跳详情/创作者。

### 5.2 作品详情 `/work/[id]`（原型 `work.html`）★最重要

- 接口：`GET /works/:id`(详情含 author/ratingDist/myFav/myAccess/myRating/previewOnly) + `GET /works/:id/ratings?sort=`(评价) + `GET /works/:id/related`(相关)。
- 顶部：返回 / 面包屑(首页/课程/作品) / 分享 / 收藏(`useFavorite`) / 举报(`openReport` → `POST /reports`)。
- 左栏：封面卡(.wd-cover, badges=免费/精品/质量) + meta(类型/大小/页数/下载/收藏/更新) + **预览区**(原型 `.preview-box`：前 N 页清晰、后续 `.blurred`、目录 `.preview-toc`，`previewOnly` 时显示「购买后解锁」) + **评价区**(.review-section：大评分 + `.rating-dist` 分布 + 排序 Tab + 评价列表 `.review-item` + 作者回复 `.review-reply`) + 相关推荐横滑。
- 右栏(sticky)：标题 + 徽标 + 评分摘要(★ 数字 人数 → 锚评价) + 价格行 + 信息行(文件/更新/热度/课程/适用/标签) + **操作区**：
  - 免费：未下载 `免费下载`、已下载 `再次下载` → `POST /works/:id/download` → toast + 弹下载链接。
  - 付费：未购 `¥x 立即购买` → `OrderModal`(`POST /works/:id/order` → mock 立即成功 / 真实拉起微信/支付宝) → 成功后 `立即下载`。
  - 评分：`hasAccess` 且未评 → `⭐ 评价` 打开 `RatingModal`(1-5 星 + 文字 + 标签 pos/neg 多选) → `POST /works/:id/ratings` → 失效回填；已评 → `已评价 X 分`。
- 信任卡：作者头像/认证✓/学院/专业/方向/荣誉/统计 → 跳 `/creator/:id`。
- 还原点：评分分布横条、评价标签(正/负色)、作者回复、预览模糊、购买状态机、质量徽标。

### 5.3 创作者主页 `/creator/[id]`（原型 `creator.html`）

- 接口：`GET /creators/:id`(profile+stats+myFollow)、`GET /creators/:id/works?filter=`、`GET /creators/:id` 动态(或 `/creators/:id/dynamics`)、`GET /creators/:id/stats`。
- Hero(`.cr-hero-bar`)：头像/姓名/认证/学校学院专业方向/bio/荣誉 + `<button class="hero-follow">` 关注(`useFollow`，全局联动首页/动态) + 私信(占位)。
- 4 大数据卡(已帮助/粉丝/作品/好评)。
- Tab：TA 的作品(全部/免费/精品/最受欢迎)、TA 的动态(`.dyn-card` 列表)、TA 的数据(作品表现表 `.tbl`)。
- 还原点：关注按钮态全局同步、动态卡可点作品。

### 5.4 关注动态 `/following`（原型 `following.html`）

- 接口：`GET /me/following/feed`。空态（未关注）→ 引导「发现优秀创作者」跳 `/search?type=creator` 或首页创作者区。

### 5.5 搜索 `/search`（原型 `search.html`）

- 读 query：`q/type/filters/sort`。
- 接口：`GET /search?q=&type=&...`。
- UI：Tab(全部/资料/创作者/学习路线/攻略/精品) + 筛选栏(.filter-bar：价格/评分/文件/更新) + 排序条(.sort-bar) + 结果(创作者 `.result-creators` + 作品 `.card-grid`) + 空态。
- 改动 query 触发 Query 重新取数（`router.push` 同步 URL）。

### 5.6 个人中心 `/me`（原型 `profile.html`，5 Tab）

- 左侧 `.side-card`(用户信息 + `.side-nav`，通知带未读 pill) + 右内容。`?tab=` 预选。
- Tab：
  - 我的资料(`GET /me/library?filter=`)：全部/已购买/已下载/收藏/待评价/已评价；行项(封面/标题/作者/获取方式/时间) + 操作(下载/再次下载/去评价/已评价/购买)。
  - 我的收藏(`GET /me/favorites`)。
  - 我的订单(`GET /me/orders`，表格)。
  - 我的评价(`GET /me/ratings`)。
  - 通知(`GET /me/notifications` + 「全部已读」`POST /me/notifications/read-all`，`.notif-item` 未读红点)。
- 还原点：与原型 5 Tab 一致；评分入口跳详情或弹 modal。

### 5.7 发布作品 `/upload`（原型 `upload.html`，5 步 Stepper）

- Zustand `upload` store：file/上传进度/AI 完善结果/表单/定价/版权。
- Step1 上传：`<Dropzone/>` → `POST /uploads/presign` → 直传 S3(presigned PUT,XHR 进度) → 显示文件 tag。
- Step2 AI 完善：原型是 mock；真实可接后端「辅助」接口 `POST /works/ai-suggest { fileKey }`（可选，后端预留；首期可前端按文件名猜或保留 mock 文案），生成标题/简介/标签/适用对象，可编辑。
- Step3 定价：免费 vs 付费(快捷价/自定义 + 预计到手 90%)。
- Step4 版权：勾选原创/合法授权（`copyrightAccepted=true`）+ 协议。
- Step5 发布：`POST /works`(DRAFT) → `POST /works/:id/publish`(PENDING) → 成功页「审核中」→ 跳 `/creator-center?tab=works`。
- 还原点：进度条、AI 完善卡(`.ai-box`)、定价卡(`.opt`)、版权勾选、成功态。

### 5.8 创作者中心 `/creator-center`（原型 `creator-center.html`）

- 需 `CreatorProfile.verified`，否则引导 `creator/apply`。
- 接口：`GET /me/creator/overview`、`/me/creator/works`、`/me/creator/data`。
- Hero：创作者身份卡 + 发布按钮 + 收益入口。
- 概览：4 大卡(已帮助 hero 橙 / 累计收益 / 粉丝 / 好评) + 分组(影响力/内容/声誉/收益) + 成就墙(`.ach-grid` got/locked)。
- Tab：我的作品(含审核状态徽标：审核中/已上架/已下架，`WorkWithStats.status`) + 数据中心(作品表现表 `.tbl`)。

### 5.9 收益中心 `/income`（原型 `income.html`）

- 接口：`GET /me/income/summary`、`/me/income/transactions`、`/me/income/payouts`、`POST /me/income/payout`。
- 4 卡(累计 hero / 本月 / 待结算 / 可提现) + 平台抽成说明(10%)。
- Tab：收益明细(表格：作品/购买者/支付/时间/到手) + 提现记录 + 「提现到微信」`WithdrawModal`(校验 ≤ balance，`INSUFFICIENT_BALANCE` 文案)。

### 5.10 登录 / 注册 / 创作者申请 / 管理后台

- `/register`：edu 邮箱 → `POST /auth/send-code`（倒计时、限流提示）→ 验证码 + 密码 + 学校/学院/专业/年级 → `POST /auth/register` → 登录态 → 跳回 `from`。
- `/login`：邮箱+密码 → `POST /auth/login`。
- `/me/creator` 申请页：bio/direction/honor/学生证上传 → `POST /me/creator/apply` → 提示等待审核。
- `/admin`：待审核作品(批量审核)、举报队列、提现审批 —— 按管理 API 实现，UI 简洁即可（原型无，按后端 API_CONTRACT）。

---

## 6. 关键流程对接（含状态机/回调）

### 6.1 登录态

- `useAuth()` = `useQuery({queryKey:['me'], queryFn:()=>apiFetch('/auth/me')})`。
- 401 时 Query 不重试，全局监听跳 `/login?from=当前路径`；登录/注册成功后 `queryClient.invalidateQueries(['me'])`。
- `['me']` 含 role/creator/未读通知数，驱动 nav 红点、权限路由（`/upload`/`/creator-center`/`/income`/`/admin` 守卫）。

### 6.2 上传直传（S3）

```
POST /uploads/presign → {fileKey, putUrl}
PUT putUrl (body=File, headers)  ← XHR 监听 upload progress
（发布时）POST /works {fileKey,...} → /works/:id/publish（后端 headObject 校验）
```

错误：`FILE_TOO_LARGE/FILE_TYPE_DENIED` → toast。

### 6.3 购买支付（mock + 真实）

```
点击「立即购买」→ OrderModal 选支付方式
POST /works/:id/order {payMethod} → {orderId, pay}
if pay.provider==='mock' → 立即成功（后端已事务完成）→ 刷新 ['works','detail']（myAccess=true）+ toast「购买成功」
if wechat → 展示 code_url 二维码 / 或跳 mweb；轮询 GET /orders/:id 直到 PAID（或支付方回跳 + 轮询）
if alipay → window.location = pay.redirectUrl → 回跳后轮询订单
→ PAID 后失效缓存，按钮变「下载作品」
```

- 轮询用 `useQuery({queryKey:['order',id], refetchInterval:o=> o.payStatus==='PAID'||'CLOSED' ? false : 2000})`。
- 超时提示「支付未完成，可重试」。

### 6.4 评分

- `RatingModal`（原型 modal 样式）：hover/click 星 → 文字 ≥5 → 标签 pos/neg 多选 → 提交 `POST /works/:id/ratings`。
- 成功：失效 `['works','detail',id]`+`['works',id,'ratings']`+`['me','ratings']`；详情均值/分布/人数与服务端一致回填；toast「评价已提交」。

### 6.5 关注/收藏/点赞 全局联动

- 关注创作者后：失效 `['creators','detail',id]`、首页创作者、`['me','following']`、`['following','feed']`（动态流下次刷新出新作）。
- 收藏：详情卡 + 列表项 + `['me','favorites']` 同步；数字乐观 ±1。
- 通知红点：写操作（购买/被关注/审核结果）后轮询/或 `refetchInterval` 刷新 `['me']`（生产可换 SSE，见 §7）。

### 6.6 举报

- `ReportModal`（原型）：原因单选(REPORT_REASONS) + 补充说明 + 恶意举报声明 → `POST /reports`。

---

## 7. 状态与缓存策略

- **服务端态全走 TanStack Query**（works/creators/orders/ratings/income/me/notifications/search/ranks）。乐观更新 + 失败回滚 + 失效策略见 §4。
- **纯客户端态 Zustand**：`ui`(modal/toast/stepper)、`upload`(发布临时态)。
- **localStorage** 只存非业务态（如「换一批」偏移、最近搜索词）；**不存**登录态/关注/收藏（这些来自服务端，避免与后端不一致）。
- **通知**：首期 `['me']` 轮询 60s；预留 `/api/v1/events`(SSE) 升级，前端切换即用。
- **金额**：展示用 `formatCny`（`¥9.90`），不做浮点运算（后端算）。

---

## 8. 测试

### 8.1 组件测试（Testing Library + Vitest）

- `<WorkCard/>`：不同状态(free/fine/quality/myFav)、点击跳转、收藏按钮。
- `<Stars/>`/`<RatingBars/>`：渲染星/分布。
- `<RatingModal/>`：hover 星、文字校验、标签多选、提交。
- `<OrderModal/>`：mock 立即成功、wechat 展示二维码、alipay 跳转。
- `<Nav/>`/`<AvatarDropdown/>`：未登录/已登录/未读红点。

### 8.2 E2E（Playwright，对应原型 7 路径，`PAYMENT_MODE=mock`）

1. 注册(edu+验证码)→登录→首页→点作品→购买(mock)→下载→评分→评价出现 + 均值/分布更新。
2. 关注创作者→`/following` 出现其动态。
3. 创作者发布(上传→AI 完善→定价→版权→提交)→`/creator-center?tab=works` 见「审核中」→ admin 审核通过→作品上架→首页/动态可见。
4. 收藏→首页卡片态+`/me/favorites`。
5. 举报作品→admin 处理。
6. `/income` 收益明细→提现申请→admin 完成→状态变化。
7. 搜索→筛选/排序→详情。

- 视觉回归：对 9 个页面截图，与原型截图对比（`playwright` visualizer / 早期手测）。

---

## 9. 分阶段实施（与后端阶段对齐）

> 后端每阶段就绪即可启动对应前端阶段；前端也可先用 MSW mock 接口并行开发。

| 阶段 | 前端目标                                                                               | 依赖后端阶段 | 测试               |
| ---- | -------------------------------------------------------------------------------------- | ------------ | ------------------ |
| F0   | 脚手架 + globals.css 迁移 + Nav/Footer/字体 + `apiFetch` + QueryProvider + Toast/Modal | 后端 0       | 布局渲染、TS 无误  |
| F1   | 鉴权页(login/register/edu 验证码/创作者申请) + `useAuth` + 路由守卫                    | 后端 2       | 注册→登录→跳回     |
| F2   | 作品列表/详情/预览/相关 + WorkCard/FineCard/RatingBars/ReviewItem                      | 后端 3       | 详情渲染、预览模糊 |
| F3   | 交易：OrderModal/支付(wechat/alipay/mock)/下载 + 状态机 + 轮询                         | 后端 4       | mock 购买全链路    |
| F4   | 评分：RatingModal + 提交后失效回填 + 标签                                              | 后端 5       | 评分资格/重算显示  |
| F5   | 社交：收藏/关注/点赞/动态/通知 + 全局联动                                              | 后端 6       | 联动一致性         |
| F6   | 创作者中心 + 收益中心 + 成就                                                           | 后端 7       | 数据/明细/提现     |
| F7   | 搜索 + 排行榜 + 质量徽标                                                               | 后端 8       | 筛选/排序/榜单     |
| F8   | 发布流程(上传 presign 直传 + AI 完善 + 定价 + 版权 + 审核态)                           | 后端 3/4 + 9 | 发布→审核→上架     |
| F9   | 举报/版权 + 管理后台(审核/举报/提现审批)                                               | 后端 9       | admin 审核闭环     |
| F10  | E2E 7 路径 + 视觉回归 + 性能(懒加载/图片) + a11y                                       | 全部         | E2E 全绿           |

每阶段流程同后端：实施 → 测试全绿 → `docs/PROGRESS.md` 反思。

---

## 10. 前后端对接清单（交叉表）

| 页面/功能      | 调用端点（API_CONTRACT）                                         | 共享 Zod 类型                  | 关键错误码处理                             |
| -------------- | ---------------------------------------------------------------- | ------------------------------ | ------------------------------------------ |
| 首页-免费      | `GET /works?isFree=true&sort=hot`                                | `WorkListItem`                 | —                                          |
| 首页-榜单      | `GET /ranks/:type`                                               | `Rank`                         | —                                          |
| 首页-动态      | `GET /me/following/feed`                                         | `Dynamic`                      | UNAUTHENTICATED→引导登录                   |
| 作品详情       | `GET /works/:id`                                                 | `WorkDetail`                   | NOT_FOUND→空态                             |
| 评价列表       | `GET /works/:id/ratings`                                         | `Rating`,`RatingSummary`       | —                                          |
| 评分           | `POST /works/:id/ratings`                                        | `CreateRatingInput`            | NO_RATING_ACCESS/ALREADY_RATED             |
| 购买           | `POST /works/:id/order` + `/orders/:id/pay` + 轮询 `/orders/:id` | `CreateOrderResult`,`Order`    | ORDER_CLOSED/PAYMENT_REQUIRED              |
| 下载           | `POST /works/:id/download`                                       | `DownloadResult`               | PAYMENT_REQUIRED                           |
| 收藏/点赞/关注 | `POST                                                            | DELETE /works/:id/favorite` 等 | —                                          | —                                               |
| 创作者主页     | `GET /creators/:id` + `/works` + `/stats`                        | `CreatorDetail`                | —                                          |
| 个人中心       | `GET /me/library                                                 | favorites                      | orders                                     | ratings                                         | notifications`               | 各  | —   |
| 创作者中心     | `GET /me/creator/overview                                        | works                          | data`                                      | `CreatorOverview`/`WorkWithStats`/`CreatorData` | FORBIDDEN(非创作者)→引导申请 |
| 收益           | `GET /me/income/summary                                          | transactions                   | payouts`,`POST /payout`                    | `IncomeSummary`/`IncomeTx`/`Payout`             | INSUFFICIENT_BALANCE         |
| 发布           | `POST /uploads/presign`→`POST /works`→`POST /works/:id/publish`  | `WorkInput`                    | COPYRIGHT_REQUIRED/FILE_TOO_LARGE/BAD_FILE |
| 搜索           | `GET /search`                                                    | —                              | —                                          |
| 举报           | `POST /reports`                                                  | `ReportInput`                  | —                                          |
| 登录/注册      | `/auth/*`                                                        | `AuthUser`                     | INVALID_CREDENTIAL/CODE_INVALID            |

---

## 文档完

前端严格按本文件 + 原型 + `API_CONTRACT.md` 实施；完成后即与后端组成生产级全栈应用，视觉与交互与原型一致，数据真实可流转。
