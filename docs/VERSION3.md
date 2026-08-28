# Campus Market — 版本三升级方案（V3）

> **给执行者的守则（先读）**
>
> 1. 本文档是版本三的**唯一执行规范**，与 `BACKEND.md` / `FRONTEND.md` / `VERSION2.md` 同一权威级别。所有字段、路由、样式值、文案以本文档为准；与现有代码冲突时以本文档为准。
> 2. 每个阶段完成后**必须**跑该阶段测试清单，全绿后再进入下一阶段；每阶段末把「做了什么 / 遇到什么问题 / 反思」追加到 `docs/PROGRESS.md`（沿用 V1/V2 的格式）。
> 3. 涉及权限、支付、处置（下架/封号）的逻辑保持**事务 + 幂等**习惯（V2 已建立）。
> 4. 任何「TODO / 暂略」都视为未完成。
> 5. 版本三**不重写已通过测试的核心交易链路**（下单/支付/退款/结算），只做产品形态升级：开放发布、分类体系、封面、预览、个人主页、举报闭环、新生专区、视觉改版。
> 6. UI 文案（按钮、提示、标签名）必须使用本文档给出的中文文案，不得自行改写。
> 7. 每个 schema 变更走 `prisma migrate dev --name <阶段名>` 生成迁移，禁止 `db push` 跳过迁移记录。

---

## 0. 版本三总览

### 0.1 背景：8 项产品决策（已与产品负责人确认，不得偏离）

| #   | 决策内容                                                                                                                                   | 落点阶段                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| 1   | 布局采用**响应式满幅**：`--maxw: min(1520px, calc(100vw - 48px))`，宽屏 5 列作品卡，整体字号上调                                           | V3-1                       |
| 2   | 举报：**不做侵权退款**；要**内容快照**；重复举报**聚合展示**，且要显示举报人列表与举报人数                                                 | V3-6                       |
| 3   | 个人主页整合所有功能；引导态**必须能跳转到发布页**；**开放发布**——无需创作者认证，所有登录用户可发布，仅保留作品上架审核；认证徽章体系后置 | V3-2（开放）+ V3-5（主页） |
| 4   | 预览：PDF 在线预览；免费作品全量预览、显示**观看量**（点击预览才算一次观看）；上传时引导转 PDF 并向创作者说明影响                          | V3-3 + V3-4                |
| 5   | 新生专区放首页**靠前位置**（免费推荐之前）；内容**偏向大学引路类**（选课/报到/宿舍/社团），不放学习资料                                    | V3-7                       |
| 6   | 分类一级大类用**用途**（如健身总结、家教教案、实习经历），二级细分学科/科目                                                                | V3-2                       |
| 7   | 封面：上传时用户**可选择封面**（自动 PDF 首页缩略 / 图标主题 / 自定义上传）                                                                | V3-3                       |
| 8   | 评分进度条 UI 直接修复                                                                                                                     | V3-1                       |

### 0.2 阶段划分与依赖

| 阶段 | 主题                               | 依赖                               | 对应问题            |
| ---- | ---------------------------------- | ---------------------------------- | ------------------- |
| V3-1 | 全站视觉升级（满幅 + 进度条 bug）  | 无                                 | 1、7                |
| V3-2 | 分类体系 + 发布开放 + 上传表单重做 | 无                                 | 3(部分)、4(引导)、6 |
| V3-3 | 封面系统（PDF 缩略 + 自定义封面）  | V3-2                               | 7                   |
| V3-4 | 在线预览 + 观看量体系              | V3-2、V3-3                         | 4                   |
| V3-5 | 个人主页整合（/user/[id]）         | V3-2                               | 3                   |
| V3-6 | 举报闭环                           | 无（建议在 V3-5 后，复用主页 tab） | 2                   |
| V3-7 | 新生专区（开学季运营位）           | V3-2                               | 5                   |
| V3-8 | 回归验收、E2E、文档收尾            | 全部                               | —                   |

执行顺序即编号顺序。V3-5 与 V3-6 之后的阶段都依赖前面阶段的表单/API 形态，不要并行乱序。

### 0.3 全局技术约束

- **新增依赖**（仅两个，在 V3-3 安装）：`pdfjs-dist`（客户端 PDF 渲染）、`pdf-lib`（客户端截取 PDF 前 N 页）。其余一律用现有依赖。
- **MinIO 对象新前缀**：`covers/`、`avatars/`、`previews/`（现有 `works/` 不变）。全部走 presign 直传，读走 302 代理路由（见各阶段）。
- **计数语义变更**（V3-4 定稿）：`Work.views` = **在线预览打开次数**（去重后），不再是详情页浏览量。`workService.get` 中现有的 `redis.incr(view:{id})` 两处**删除**，计数移入预览端点。`view-sync` 定时任务（scheduler）无需改动，key 空间不变。
- **JWT 内 role 过期问题**：开放发布后首次发布会把 `STUDENT` 升级为 `CREATOR`，但 JWT 里的 role 要等重新登录才刷新。**权威判定一律走 DB**（`ensurePublisher` 查库），JWT role 仅用于前端展示。不做过期令牌刷新。
- 每阶段完成即跑：`pnpm typecheck && pnpm lint && pnpm test`。

---

## V3-1 全站视觉升级（响应式满幅 + 评分条修复）

### 目标

消除 1440/1920 屏幕下左右大块空白；作品卡在宽屏增至 5 列；全局字号上调一档；修复评分分布进度条不显示的 bug；星级支持半星。

### 1.1 满幅布局

`src/styles/globals.css`：

```css
/* :root 中 */
--maxw: min(1520px, calc(100vw - 48px)); /* 原 1240px */
```

`.page` / `.wrap` / `.nav-inner` 等所有引用 `var(--maxw)` 的容器自动生效，无需逐个改。

**网格断点**（`globals.css` 中对应规则修改）：

| 类           | 原                 | 新                                                                     |
| ------------ | ------------------ | ---------------------------------------------------------------------- |
| `.card-grid` | 4 / 1180→3 / 880→2 | base 4；`@media (min-width:1360px)` 5；1180-1360 4；880-1180 3；<880 2 |
| `.fine-grid` | `repeat(3, 1fr)`   | base 3；`@media (min-width:1360px)` `repeat(4, 1fr)`                   |

实现方式：把 `.card-grid` 的 media query 从 `max-width` 改为移动优先写法或补 `min-width` 查询均可，最终效果必须符合上表。

**字号上调**（基准值，实施后用截图目测微调，允许 ±0.5px）：

| 位置                            | 原     | 新                              |
| ------------------------------- | ------ | ------------------------------- |
| `body` 基础字号                 | 14px   | 15px                            |
| `.page-head h1`                 | 22px   | 24px                            |
| 作品卡标题（`.work-card b` 等） | 13.5px | 14.5px                          |
| 卡片次级文字（sub/meta）        | 12px   | 12.5px                          |
| `.page` 移动端左右 padding      | 28px   | 20px（仅 `max-width:680px` 内） |

### 1.2 评分分布进度条修复（bug 根因）

根因：CSS（`globals.css:1952-1984`）选择器是 `.rd-row .lb`、`.rd-row .bar i`、`.rd-row .v`，而 `src/components/work/RatingBars.tsx` 渲染的类名是 `rd-label`、`bar-fill`（div）、`rd-count`，完全对不上，`bar-fill` 无任何样式故不可见。

**修法：改 JSX 对齐 CSS**（不动 CSS）：

```tsx
// RatingBars.tsx 内
<span className="lb">{star} 星</span>
<div className="bar"><i style={{ width: `${pct}%` }} /></div>
<span className="v">{count}</span>
```

### 1.3 半星支持

`src/lib/icons.tsx` 的 `Star` 组件与 `src/components/common/Stars.tsx`：`value` 非整时（如 4.4），不足整数的下一颗渲染半星。实现方式（双层叠加）：

```tsx
<span style={{ position: 'relative', display: 'inline-flex' }}>
  <Star on={false} />
  <span style={{ position: 'absolute', inset: 0, width: '50%', overflow: 'hidden' }}>
    <Star on />
  </span>
</span>
```

`Stars.tsx` 的 `rounded = Math.round(value)` 改为 `full = Math.floor(value)` + `half = value - full >= 0.25 && value - full < 0.75`（0.75 以上进位整星，<0.25 不显示半星）。仅展示组件可点击评分态仍按整星。

### 1.4 改动清单

| 文件                                 | 改动                              |
| ------------------------------------ | --------------------------------- |
| `src/styles/globals.css`             | `--maxw`、网格断点、字号基准      |
| `src/components/work/RatingBars.tsx` | 类名对齐 CSS                      |
| `src/components/common/Stars.tsx`    | 半星逻辑                          |
| `src/lib/icons.tsx`                  | Star 半星渲染支持（如需拆新组件） |

### 1.5 测试清单

- [ ] `pnpm typecheck` / `pnpm lint` 通过
- [ ] `pnpm test` 全绿（本阶段不改后端，95/95 不变）
- [ ] Playwright 量测（参考根目录 `.shot.mjs` 改造）：1440 宽视口下 `main.page` 左右空白 ≤ 24px；1920 宽下内容区 ≥ 1472px；作品卡宽度落在 240~340px
- [ ] 1360px / 900px / 375px 三档宽度下 `card-grid` 分别为 5 / 3~4 / 2 列，无横向滚动条
- [ ] 任意作品详情页：评分分布 5 行进度条可见、有渐变填充、行内「N 星 / 条数」文字对齐
- [ ] 评分为 4.4 的作品：展示 4 颗整星 + 1 颗半星

---

## V3-2 分类体系 + 发布开放 + 上传表单重做

### 目标

建立「用途大类 → 学科/标签」两级分类；上传表单重做（分类选择 + 预设标签池 + PDF 引导）；**开放发布权限**——所有登录用户可发布，仅保留作品上架审核。

### 2.1 数据模型

`prisma/schema.prisma` 新增枚举与字段：

```prisma
enum Category {
  COURSE   // 课程学习
  EXAM     // 升学备考
  CAREER   // 求职实习
  TUTOR    // 家教教案
  LIFE     // 生活成长
  CAMPUS   // 新生引路
}

model Work {
  // ...
  category Category @default(COURSE)
}
```

迁移：`pnpm prisma migrate dev --name v3_add_category`。存量数据（种子）重跑 seed 回填，无需数据修复 SQL。

### 2.2 分类与标签池常量（权威定义，前端后端共用）

`src/lib/constants.ts` 追加：

```ts
export const CATEGORIES = [
  { key: 'COURSE', label: '课程学习', icon: '🎓', desc: '期末复习 · 题库 · 课件 · 笔记' },
  { key: 'EXAM', label: '升学备考', icon: '🧗', desc: '四六级 · 考研 · 保研 · 留学考试' },
  { key: 'CAREER', label: '求职实习', icon: '💼', desc: '实习经历 · 简历 · 面试 · 校招' },
  { key: 'TUTOR', label: '家教教案', icon: '📖', desc: '各科教案 · 辅导材料 · 家教经验' },
  { key: 'LIFE', label: '生活成长', icon: '🌱', desc: '健身 · 技能 · 理财 · 时间管理' },
  { key: 'CAMPUS', label: '新生引路', icon: '🏫', desc: '选课 · 报到 · 宿舍 · 社团 · 校园生活' },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]['key'];

/** 预设标签池：按大类分组。上传表单按所选大类展示该组 chips（多选 ≤5），另允许自填 1 个自定义标签。 */
export const PRESET_TAGS: Record<CategoryKey, string[]> = {
  COURSE: ['期末复习', '题库真题', '课堂笔记', '课件PPT', '实验报告', '课程设计', '习题答案'],
  EXAM: ['四级', '六级', '考研', '保研', '雅思', '托福', '专升本'],
  CAREER: ['实习经历', '简历模板', '面试经验', '校招攻略', '求职复盘'],
  TUTOR: ['数学教案', '英语教案', '理科教案', '文科教案', '全科辅导', '家教经验'],
  LIFE: ['健身总结', '技能学习', '理财入门', '时间管理', '读书笔记', '减肥打卡'],
  CAMPUS: ['选课攻略', '报到流程', '军训生存', '宿舍生活', '社团指南', '校园地图', '开学考试', '英语分级', '转专业', '食堂测评', '校园卡', '生活费攻略'],
};

export const CATEGORY_LABEL: Record<CategoryKey, string> = ...; // 由 CATEGORIES 派生
```

### 2.3 开放发布（权限改造）

**语义变更**：`CreatorProfile.verified` 从「发布门槛」降级为「认证徽章」（展示用）。发布只需登录 + 账号 ACTIVE。

`src/server/auth/session.ts`：

- 删除 `requireCreator`，新增 `ensurePublisher`：

```ts
/** 发布门槛：登录即可。无 CreatorProfile 则自动创建（未认证），STUDENT 升级 CREATOR。 */
export async function ensurePublisher(): Promise<Session & { creatorProfileId: string }> {
  const s = await requireUser();
  let cp = await prisma.creatorProfile.findUnique({ where: { userId: s.userId } });
  if (!cp) {
    cp = await prisma.creatorProfile.create({
      data: { userId: s.userId, bio: '', direction: '校园分享者', verified: false },
    });
  }
  if (s.role === 'STUDENT') {
    await prisma.user.update({ where: { id: s.userId }, data: { role: 'CREATOR' } });
  }
  return { ...s, role: s.role === 'STUDENT' ? 'CREATOR' : s.role, creatorProfileId: cp.id };
}
```

- **替换所有调用点**：`POST /works`、`POST /works/[id]/publish`、`/me/creator/overview|data|works`、`/me/income/*`（payout/summary/transactions）。全局 `grep requireCreator` 必须为 0 处残留。
- `src/server/auth/rbac.ts`：`PERMISSIONS.upload` 改为 `['STUDENT', 'CREATOR', 'ADMIN']`。
- `/me/creator/apply`（申请认证）**保留不动**——认证流程后置，admin 认证 Tab 保留。前端入口本阶段不做（V3-5 在个人主页放一个小入口，可选）。
- 前端 `/upload` 页面：移除任何「创作者才可发布」的假设（当前页面本身没有硬校验，确认路由无门槛即可）。

### 2.4 API 变更

`GET /api/v1/works` query 新增 `category`（可选，枚举值）。落点：

- `src/lib/zod/work.ts`：`workQuerySchema` 加 `category: z.enum([...]).optional()`。
- `src/server/services/work.service.ts` `list()`：`if (q.category) where.category = q.category;`（注意 cacheKey 已含全量 query 对象，自动隔离）。
- 响应 `WorkListItem` 增加 `category` 字段（`toListItem` 补一行）。
- `workInputSchema` 加 `category: z.enum([...]).default('COURSE')`，`workService.create/update` 落库。

### 2.5 上传表单重做（`src/app/(site)/upload/page.tsx`）

表单结构（自上而下）：

1. **作品文件**（不变，加引导，见下）
2. 标题 / 简介 / 适用课程（不变；课程 placeholder 改为「学科或课程名，如：高等数学 / 大学英语 / 数据库原理」）
3. **用途大类**（新增）：6 个 chip 单选（`CATEGORIES` 渲染，icon + label + desc），默认不选，必选
4. **标签**（改造）：选中大类后展示该组 `PRESET_TAGS` chips（多选，与自定义合计 ≤5）；末尾一个「+ 自定义」输入框（回车添加，仅允许 1 个自定义标签）
5. 定价 / 原创声明 / 版权勾选（不变）
6. （V3-3 将在版权勾选后插入「封面」步骤）
7. 提交按钮

**非 PDF 文件的预览引导**（决策 4 的落点）：文件选择后，若扩展名非 `pdf`，在文件框下方显示黄色提示条 + 确认勾选：

> ⚠️ **该格式不支持在线预览**
> PDF 格式的资料可以在站内直接翻阅，获得更多观看量。建议用 Word / PPT 的「导出为 PDF」功能转换后再上传。
> ☐ 我了解该格式无法在线预览，仍要上传

未勾选时禁止提交。PDF 文件则显示绿色提示：「✓ PDF 可在线预览，推荐」。

提交成功后跳转改为 `router.push('/me')`（V3-5 后跟随个人主页路由变化，见该阶段）。

### 2.6 分类浏览页 `/explore`（新增）

`src/app/(site)/explore/page.tsx`（client component，支持 URL query）：

- 左侧（桌面端，移动端折叠为顶部横向 chips）：**用途大类**侧栏——全部 + 6 大类（icon + label + 该类作品数，数量用 `GET /works?category=X&pageSize=1` 的 total 汇总，可聚合一个轻量接口或并行请求 6 次，选择并行请求 6 次，简单）。
- 右侧上部：**二级过滤 chips**——当前大类下的 `PRESET_TAGS`（点击=`tag` 过滤）+ **热门课程 chips**（数据来源：新增 `GET /api/v1/works/courses?category=X`，返回 `[{course, count}]` top 10，`workService` 加一个 `groupBy course` 查询）；`sort` 下拉（最新/最热/好评）；免费/付费切换（全部/免费/精品）。
- 右侧主体：`card-grid`，混合渲染——`isFree` 用 `WorkCard`、付费用 `FineCard`（两列瀑布不混排的话可统一 `WorkCard` 并在卡上带价格徽章，实施时以视觉协调为准，倾向混合渲染）。
- URL 参数即状态：`/explore?cat=CAMPUS&tag=选课攻略&sort=hot&price=free`，分享/回退友好。

**首页联动**（本阶段一起做）：`src/app/(site)/page.tsx` 校园专区「今日免费推荐」上方加一行**分类快捷入口**：

```
📚 分类浏览：  [全部] [🎓 课程学习] [🧗 升学备考] [💼 求职实习] [📖 家教教案] [🌱 生活成长] [🏫 新生引路]   →「浏览全部分类」
```

chips 点击跳转 `/explore?cat=XXX`，不改首页列表本身的查询逻辑（首页保持运营推荐位）。

### 2.7 种子与测试数据

`prisma/seed.ts`：

- 为现有 20 个作品按内容语义分配 `category`（复习/题库类→COURSE，四六级→EXAM 等）。
- `Tag` 表补充 `PRESET_TAGS` 全量标签（幂等 upsert）。
- 现有作品的 tags 调整为优先使用预设池标签，保证 explore 页 chips 有数据。
- `prisma/seed.test.ts` / `tests/integration/schema.test.ts`：行数断言按新增标签数更新。

### 2.8 改动清单

| 文件                                     | 改动                                  |
| ---------------------------------------- | ------------------------------------- |
| `prisma/schema.prisma` + 迁移            | `Category` 枚举 + `Work.category`     |
| `src/lib/constants.ts`                   | `CATEGORIES` / `PRESET_TAGS`          |
| `src/lib/zod/work.ts`                    | query/input 加 category               |
| `src/server/services/work.service.ts`    | list 过滤 + toListItem + courses 聚合 |
| `src/app/api/v1/works/courses/route.ts`  | 新增（GET，公开）                     |
| `src/server/auth/session.ts` / `rbac.ts` | requireCreator → ensurePublisher      |
| 上述 2.3 列出的全部调用点路由            | 权限替换                              |
| `src/app/(site)/upload/page.tsx`         | 表单重做                              |
| `src/app/(site)/explore/page.tsx`        | 新增分类页                            |
| `src/app/(site)/page.tsx`                | 分类快捷入口行                        |
| `src/lib/types.ts`                       | `WorkListItem.category`               |
| `prisma/seed.ts` / `seed.test.ts`        | category 回填 + 预设标签              |

### 2.9 测试清单

- [ ] typecheck / lint / test 通过；新增集成测试：
  - [ ] 学生账号（无 CreatorProfile）`POST /works` 成功，且自动创建未认证 CreatorProfile、role 升级 CREATOR（二次发布不重复创建）
  - [ ] `GET /works?category=CAMPUS` 只返回 CAMPUS 作品
  - [ ] `GET /works/courses?category=COURSE` 返回 course 聚合数组
- [ ] 手动：上传表单不选大类无法提交；选大类后标签池联动；自定义标签只能加 1 个；合计 >5 拒绝
- [ ] 手动：选择 .docx 文件出现黄色引导 + 必须勾选才能提交；选择 .pdf 出现绿色提示
- [ ] 手动：`/explore` 各筛选组合 URL 正确、结果正确；首页 chips 跳转正确

---

## V3-3 封面系统（PDF 首页缩略 + 自定义封面）

### 目标

每个作品都有「真实封面」：PDF 默认截首页缩略；用户可改用图标+主题或上传自定义图片。列表卡片、详情页、相关推荐全部优先渲染图片封面。

### 3.1 依赖与数据模型

- `pnpm add pdfjs-dist pdf-lib`
- `prisma/schema.prisma`：`Work.coverKey String?`（封面图对象键）。迁移 `v3_add_cover_preview_key`（一次迁移同时加 `coverKey` 与 V3-4 要用的 `previewKey`，避免两次迁移：`previewKey String?` 一并加上，V3-4 直接使用）。

### 3.2 上传端 presign 扩展

`src/server/services/upload.service.ts` 的 `presign` 入参加 `kind`：

```ts
input: { kind: 'work' | 'cover' | 'avatar' | 'preview'; fileType: FileType; fileSize: number; sha?: string }
```

| kind    | 允许类型     | 大小上限 | key 前缀          | 说明                        |
| ------- | ------------ | -------- | ----------------- | --------------------------- |
| work    | 全部白名单   | 200MB    | `works/{uid}/`    | 现状不变                    |
| cover   | PNG/JPG/WEBP | 5MB      | `covers/{uid}/`   | 自定义封面                  |
| avatar  | PNG/JPG/WEBP | 5MB      | `avatars/{uid}/`  | V3-5 头像用（本阶段先放开） |
| preview | PDF          | 30MB     | `previews/{uid}/` | V3-4 付费试读副本           |

`presignPut` 调用时传正确 `contentType`（image/* 与 application/pdf）。zod 校验同步（`src/lib/zod/common.ts` 或 upload 相关 schema）。

### 3.3 上传表单「封面」步骤（`upload/page.tsx`）

版权勾选之上插入封面区，逻辑分三种情况：

**A. 上传的是 PDF（自动封面）**

选择文件后（不阻塞表单填写，异步执行）：

1. `pdfjs-dist` 动态加载（`const pdfjs = await import('pdfjs-dist')`），`getDocument(file.arrayBuffer())`。
2. 渲染第 1 页到离屏 canvas（按宽度 600px 等比缩放，devicePixelRatio 2），`canvas.toBlob('image/jpeg', 0.85)`。
3. 封面区显示该图预览 + 文案「已自动生成封面（PDF 第 1 页）」+ 三个操作：
   - **采用自动封面**（默认选中）
   - **选图标和配色**：回到现有 emoji + `coverTheme` 选择器（提供 10 个主题色 + 常用学科图标 ~24 个网格）
   - **上传自定义封面**：文件选择（图片），本地预览，上传后使用

**B. 上传的是非 PDF（无自动缩略）**

默认展示「选图标和配色」选择器（预选一个与分类匹配的默认值：COURSE→📖、EXAM→🧗、CAREER→💼、TUTOR→📐、LIFE→🌱、CAMPUS→🏫 + 自动主题色），同样提供「上传自定义封面」。

**C. 提交时**

- 自动封面 / 自定义封面：先 `presign({kind:'cover'})` → PUT 上传 → `coverKey` 随作品创建提交。
- 图标配色：`coverKey` 为空，`coverIcon` + `coverTheme` 照旧。
- `workInputSchema` 加 `coverKey: z.string().optional()`；`workService.create` 落库；`publish` 的 `headObject` 校验**只针对 fileKey**（coverKey 可选，提供时也校验存在）。

**pdfjs 在 Next 14 的接入注意**：仅在 `useEffect`/事件回调中动态 `import('pdfjs-dist')`；worker 配置 `pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()`（webpack 5 原生支持）；若 worker 加载失败降级 `disableWorker`。不要在模块顶层 import。

### 3.4 封面读取路由（302 代理 + 浏览器缓存）

新增 `src/app/api/v1/works/[id]/cover/route.ts`（GET，公开——middleware 已放行 `/api/v1/works` 的 GET）：

```ts
// 查 work.coverKey → 有：302 到 presignGetInline(coverKey)（1h 有效，inline 展示）
// 无：404。响应头 Cache-Control: public, max-age=3600（302 也可带，浏览器缓存整条链）
```

`src/server/storage/minio.ts` 新增：

```ts
/** 内联展示 GET（1 小时，Content-Disposition: inline）— 封面/头像/预览用 */
export async function presignGetInline(key: string, contentType?: string);
```

**前端统一约定**：任何地方渲染封面都是 `<img src={/api/v1/works/${id}/cover} />`——列表页 20 张图就是 20 个 302，浏览器缓存 1h，成本可忽略。**列表 API 不内嵌 presigned URL**（避免缓存序列化长 URL、避免 toListItem 异步化）。封面 404 时 `<img onError>` 回退到 emoji+theme 渲染（封装一个 `WorkCover` 组件：`src/components/work/WorkCover.tsx`，接收 work，内部处理图片/回退/加载态）。

### 3.5 各处渲染替换

新建 `WorkCover` 组件后，替换以下位置的首图渲染（逻辑：有 coverKey→img（失败回退），无→现有 emoji+theme 块）：

- `src/components/work/WorkCard.tsx`（卡头）
- `src/components/work/FineCard.tsx`（cover 区，高度维持 136px→提到 160px 配合大布局）
- `src/app/(site)/work/[id]/WorkDetailClient.tsx`（`.wd-cover` 的 cover-top：有图时为图 + 底部渐变遮罩放徽章/水印文字）
- `src/app/(site)/me/page.tsx` 资料/收藏行内小图（V3-5 重构时随主页走）

### 3.6 种子数据真实化

`prisma/seed.ts`：为 20 个种子作品生成真实对象，保证封面/预览在演示环境不是死链：

- 生成一个极简合法 PDF（手写 PDF 字节或用 `pdf-lib` 在 seed 中生成 3~5 页文字 PDF，每页作品标题），`putObject` 到 `works/seed/{workId}.pdf` 作为 `fileKey`；付费作品同时截前 5 页存 `previews/seed/{workId}.pdf` 作为 `previewKey`（pdf-lib 服务端可用）。
- 封面：用 pdf-lib/SVG→PNG 不可行的话，直接生成**纯色渐变 + emoji + 标题文字的 JPEG**（用 `canvas` 不可用在 node——改用 `pdf-lib` 生成第 1 页后用无依赖方案：seed 中预置 6 张分类底图 buffer（内嵌 base64 小图 ~20KB），叠加不做），**简化定稿**：seed 封面 = 每作品以分类色 + emoji 主题保持 `coverIcon/coverTheme` 现状（不生成图片封面），仅文件与预览对象真实化。若视觉验收时种子页面太素，再补生成。

### 3.7 改动清单

| 文件                                         | 改动                      |
| -------------------------------------------- | ------------------------- |
| `package.json`                               | + pdfjs-dist、pdf-lib     |
| `prisma/schema.prisma` + 迁移                | coverKey、previewKey      |
| `src/server/services/upload.service.ts`      | kind 扩展                 |
| `src/server/storage/minio.ts`                | presignGetInline          |
| `src/app/api/v1/works/[id]/cover/route.ts`   | 新增 302 路由             |
| `src/app/(site)/upload/page.tsx`             | 封面步骤 + pdfjs 自动缩略 |
| `src/components/work/WorkCover.tsx`          | 新增统一封面组件          |
| `WorkCard` / `FineCard` / `WorkDetailClient` | 渲染替换                  |
| `src/lib/zod/work.ts` / `work.service.ts`    | coverKey/previewKey 落库  |
| `prisma/seed.ts`                             | 真实文件/预览对象         |

### 3.8 测试清单

- [ ] typecheck / lint / test 通过；新增集成：cover 路由（有 coverKey→302；无→404）；presign kind=cover 拒绝非图片/超 5MB
- [ ] 手动（核心验收）：上传一个多页 PDF → 封面区自动出现第 1 页缩略 → 提交 → 列表卡片显示该图；切「图标配色」再提交 → 显示图标封面；传自定义图片 → 显示自定义封面
- [ ] 手动：上传 DOCX → 无自动缩略，图标配色默认随分类，可自定义
- [ ] 手动：删除 MinIO 中某封面对象后刷新列表 → 该卡回退 emoji 封面，不出现裂图
- [ ] 手动：种子作品详情可下载、（V3-4 后）可预览，不再是死链

---

## V3-4 在线预览 + 观看量体系

### 目标

免费作品全量在线预览（PDF 翻页阅读器）；付费作品预览前 5 页 + 水印 + 购买引导；观看量 = 预览打开次数（去重）；免费作品对外的核心指标从下载量切换为观看量。

### 4.1 上传端：付费作品生成试读副本

`upload/page.tsx` 提交流程中，若 `fileType === 'PDF' && !isFree`：

1. `pdf-lib`：`PDFDocument.load(bytes)` → `copyPages(doc, [0..4])` → `save()` → Blob（不足 5 页取全部）。
2. `presign({kind:'preview'})` → PUT → `previewKey` 随作品提交。

免费 PDF 不生成副本（直接预览原文件）。非 PDF 无预览能力。

### 4.2 预览端点（单一端点：签 URL + 计数）

新增 `src/app/api/v1/works/[id]/preview/route.ts`（POST）：

```
POST /api/v1/works/{id}/preview
→ 200 {
    mode: 'full' | 'sample' | 'none',
    url: string | null,      // presignGetInline，10 分钟有效
    pages: number,           // 文件页数（work.pages，未知为 0）
    hasPreview: boolean
  }
```

权限矩阵（服务端 `workService.getPreview(id, viewer)` 实现）：

| 身份                    | mode   | url 指向                              |
| ----------------------- | ------ | ------------------------------------- |
| 免费作品（任何人）      | full   | 原文件 fileKey                        |
| 付费未购（任何人）      | sample | previewKey；无 previewKey → mode none |
| 付费已购 / 作者 / ADMIN | full   | 原文件 fileKey                        |

- 非 PDF（DOC/PPT/ZIP 等）一律 `mode:'none'`。
- **middleware**：`/api/v1/works` 仅 GET 公开，需为 POST 的该路径放行匿名：在 `src/middleware.ts` isPublic 规则加 `pathname.match(/\/api\/v1\/works\/[^/]+\/preview$/)`（方法 POST 也放行）。
- **观看计数（决策 4 核心）**：本端点内完成——
  - 登录：`SETNX view:u:{userId}:{workId} EX 86400`；匿名：`SETNX view:i:{ip}:{workId} EX 86400`（ip 取 `x-forwarded-for` 首段）。
  - SETNX 成功 → `INCR view:{workId}`（现有 view-sync 定时任务每 5 分钟回写 DB，无需改动）。
  - **同时删除 `workService.get` 中现有的两处 `redis.incr(view:{id})`**（约 work.service.ts:112、129），观看量语义自此唯一。
- 限流：`enforceRateLimit('rl:preview:{ip}', 30, 60_000)` 防刷签名 URL。
- 作品未发布（PUBLISHED 之外，作者/管理员除外）→ NOT_FOUND。

### 4.3 预览器组件

新增 `src/components/work/PreviewModal.tsx`（全屏 overlay，ESC/点击遮罩关闭）：

- 打开即调 `POST /works/{id}/preview`；`mode:'none'` → toast「该格式暂不支持在线预览，可下载后查看」。
- `pdfjs-dist` 渲染：初始渲染前 3 页到独立 canvas（宽度撑满容器，居中，页间距 12px，底部页码「N / 总页数」）；滚动接近未渲染页时继续渲染（IntersectionObserver 或 scroll 监听，简单实现即可）。
- `mode:'full'`：全部页可渲染（单次会话渲染上限 200 页，超出提示「仅展示前 200 页」）。
- `mode:'sample'`：渲染 previewKey 的页 + **水印层** + 尾部购买卡。
- **水印层**（仅 sample）：`position:fixed; inset:0; pointer-events:none; z-index` 高于 canvas——背景 `repeating-linear-gradient(45deg, transparent 0 120px, rgba(0,0,0,.03) 120px 240px)` + 绝对定位铺 12~20 个 `{用户名 or '访客'} · Campus Market` 文字（rgba(0,0,0,.08)，rotate -30deg）。登录用户用其用户名。
- **尾部购买卡**（仅 sample）：渐变遮罩 + 「继续阅读完整版」+ 价格 + [¥ 立即购买] 按钮（复用 OrderModal 触发逻辑，通过 props 回调打开）。
- 顶栏：作品标题 + 页码 + [下载]（有权限时）/ [关闭]。

### 4.4 观看量展示切换

| 位置                                 | 规则                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `WorkCard`（免费卡）                 | 👁 `{formatNum(views)}` 观看 + ♥ favs（**去掉下载量**，本就不显示，确认） |
| `WorkCard`（付费卡，explore 混排时） | ⬇ `{downloads}` 已帮助（保持）                                           |
| `FineCard`（付费）                   | 不变（已帮助 downloads / favs / 评分）                                   |
| 详情页 `cover-meta`                  | 免费作品：👁 观看 + ♥ 收藏（**移除下载次数**）；付费：不变（下载/收藏）   |
| 详情页「热度」info-row               | 统一显示：免费 `观看 X · 收藏 Y`；付费 `下载 X · 收藏 Y · 观看 Z`        |
| 排行榜                               | 助人榜仍用 downloads（语义=实际帮助），不改                              |

### 4.5 详情页操作区重排（`WorkDetailClient.tsx` info-actions）

| 身份          | 主按钮                         | 次按钮                                         |
| ------------- | ------------------------------ | ---------------------------------------------- |
| 免费作品      | `▶ 在线预览`（mint）           | `⬇ 下载`（light）                              |
| 付费未购      | `¥{price} 立即购买`（primary） | `▶ 试读前 5 页`（light，无 previewKey 时隐藏） |
| 付费已购/作者 | `⬇ 下载`（primary）            | `▶ 在线预览`（light）                          |

预览按钮共用 `PreviewModal`；购买成功回调里刷新详情（现有 invalidate 逻辑）。

### 4.6 改动清单

| 文件                                            | 改动                            |
| ----------------------------------------------- | ------------------------------- |
| `src/app/(site)/upload/page.tsx`                | 付费 PDF 试读副本生成           |
| `src/app/api/v1/works/[id]/preview/route.ts`    | 新增                            |
| `src/middleware.ts`                             | preview POST 匿名放行           |
| `src/server/services/work.service.ts`           | getPreview + 删除 get 里的 incr |
| `src/components/work/PreviewModal.tsx`          | 新增预览器                      |
| `src/components/work/WorkCard.tsx`              | 观看量展示                      |
| `src/app/(site)/work/[id]/WorkDetailClient.tsx` | 按钮区重排 + meta 切换          |
| `src/lib/types.ts` / API 契约                   | preview 响应类型                |

### 4.7 测试清单

- [ ] typecheck / lint / test；新增集成测试：
  - [ ] 免费作品匿名 POST preview → mode full；付费未购 → mode sample（有 previewKey）/ none（无）；付费后 → full
  - [ ] 观看去重：同 userId 连打 2 次 → `view:{id}` 只 +1；不同用户各 +1
  - [ ] 未发布作品匿名 → 404
- [ ] 手动：免费 PDF 预览滚动翻页流畅、200 页上限提示；付费未购只出 5 页 + 水印 + 购买卡，点购买走收银台；购买后重开预览变全量
- [ ] 手动：DOCX 作品预览按钮 → toast 提示；其详情页不显示「试读」按钮
- [ ] 手动：上传付费 PDF → MinIO 出现 previews/ 副本；卡片观看量随预览打开增长（等 view-sync 或直接看 redis）
- [ ] 回归：`pnpm worker` 跑着时 view-sync 每 5 分钟回写无报错

---

## V3-5 个人主页整合（/user/[id]）

### 目标

一个页面承载全部个人功能：作品、评价、关注、粉丝、收藏、资料库、订单、收益、通知、我的举报（V3-6 接入）；支持编辑资料与头像上传；`/me`、`/creator/[id]`、`/creator-center`、`/income` 全部收编。

### 5.1 数据模型

```prisma
model User {
  // ...
  bio       String?  @db.VarChar(200)   // 个人简介（从 CreatorProfile 提升到用户层）
  avatarKey String?                     // 头像图片（MinIO avatars/）；无则用 avatarColor 首字母
}
```

迁移 `v3_user_bio_avatar`。`CreatorProfile.bio` 保留不删（历史数据），读取时 `user.bio ?? user.creator?.bio` 兜底，写入一律写 User.bio。

### 5.2 新 API

| 方法  | 路由                                                   | 权限 | 说明                                                                                                                                                               |
| ----- | ------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET   | `/api/v1/users/[id]`                                   | 公开 | 主页数据：username/avatarColor/avatarUrl(has key)/bio/college/grade/major/verified/honor/direction、stats{works,fans,following,helped,avgRating}、myFollow、isSelf |
| GET   | `/api/v1/users/[id]/works`                             | 公开 | 迁移自 `/creators/[id]/works`（filter: all/free/fine/hot）                                                                                                         |
| GET   | `/api/v1/users/[id]/ratings`                           | 公开 | TA 的评价历史（含 work:{id,title}）                                                                                                                                |
| GET   | `/api/v1/users/[id]/follows?type=following\|followers` | 公开 | 分页 20/页：[{id, username, avatarColor, bio, college, fans, myFollow}]                                                                                            |
| POST  | `/api/v1/users/[id]/follow`                            | 登录 | 迁移自 `/creators/[id]/follow`                                                                                                                                     |
| PATCH | `/api/v1/me/profile`                                   | 登录 | `{username?, bio?, college?, grade?, major?}`；username 查重→USERNAME_TAKEN；zod 限长                                                                              |
| POST  | `/api/v1/me/avatar`                                    | 登录 | `{avatarKey}`（前端先 presign kind=avatar 直传）校验对象存在                                                                                                       |
| GET   | `/api/v1/users/[id]/avatar`                            | 公开 | 302 → presignGetInline(avatarKey)（同封面模式，Cache-Control 1h）                                                                                                  |
| GET   | `/api/v1/me/reports`                                   | 登录 | V3-6 实现（我的举报列表），本阶段先建路由占位返回 []                                                                                                               |

- **删除** `/api/v1/creators/*` 全部四个路由（detail/stats/works/follow），逻辑迁入 `social.service` / 新 `user.service`（或直接扩展现有 social.service，文件自定，命名清晰即可）。
- **middleware** isPublic 增加 GET 前缀 `/api/v1/users`（POST follow 不在公开列，靠 cookie）。
- `buildAuthUser`（auth.service）：返回体加 `bio`、`avatarUrl`（'/api/v1/users/{id}/avatar' 或 null）。
- 现有 hooks（`useCreator`/`useSocial`）改指向新端点；`ranks` API 不动。

### 5.3 页面 `/user/[id]/page.tsx`

客户端组件（项目现状以 client 为主，保持一致）。结构：

```
┌─ hero 区（参考现 creator/[id] 的 cr-hero-bar，加高）
│   大头像（avatarKey→img，否则首字母色块） + 用户名 + 认证徽章(verified) +
│   学院·年级·专业 + bio + 标签行(direction/honor)
│   操作区：他人 → [＋关注 TA] [⋯举报]（V3-6 接入）
│           本人 → [编辑资料] [发布作品]
├─ 数据条（stat-grid）：粉丝 | 关注 | 作品 | 已帮助 | 好评率
├─ tab 栏（横向，溢出滚动）
│   他人：作品 · 评价 · 关注 · 粉丝
│   本人：作品 · 评价 · 关注 · 粉丝 · 收藏 · 资料库 · 订单 · 收益 · 通知 · 我的举报
└─ tab 内容区
```

各 tab 内容来源（大部分是搬迁现有页面代码）：

| tab       | 他人                                                     | 本人额外                                                                                                                                                                                                                                                             |
| --------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 作品      | `WorkCard` 网格（free/fine/hot 子筛选）                  | 本人视图：卡片带状态角标（审核中/已驳回+原因 tooltip/草稿）；子切换「展示 / 数据分析」——数据分析=原 creator-center 数据表（浏览/下载/收藏/评分/收益列）；**空态=引导卡：「发布你的第一份资料，帮助学弟学妹」+ [→ 去发布] 按钮跳 `/upload`**（决策 3 明确要求可跳转） |
| 评价      | `/users/[id]/ratings` 列表                               | 同数据                                                                                                                                                                                                                                                               |
| 关注/粉丝 | follows 列表（行卡：头像+用户名+学院+粉丝数+[关注]按钮） | 同                                                                                                                                                                                                                                                                   |
| 收藏      | 隐藏                                                     | 现 me 页 favs tab                                                                                                                                                                                                                                                    |
| 资料库    | 隐藏                                                     | 现 me 页 library tab                                                                                                                                                                                                                                                 |
| 订单      | 隐藏                                                     | 现 me 页 orders tab                                                                                                                                                                                                                                                  |
| 收益      | 隐藏                                                     | **整个 /income 页迁入**：4 stat 卡 + 收益明细/提现记录子 tab + WithdrawModal                                                                                                                                                                                         |
| 通知      | 隐藏                                                     | 现 me 页 notif tab + 全部已读                                                                                                                                                                                                                                        |
| 我的举报  | 隐藏                                                     | V3-6 填充                                                                                                                                                                                                                                                            |

### 5.4 编辑资料 Modal

新增 `src/components/form/EditProfileModal.tsx`：头像（点击上传图片，presign kind=avatar；或恢复颜色选择器 8 色）+ 用户名 + 个人简介（≤200）+ 学院/年级/专业（文本）。保存 `PATCH /me/profile`，成功后 invalidate auth/me + 用户主页查询。

### 5.5 路由收编与跳转

| 旧路由            | 处理                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/me`             | 客户端读 auth：未登录→`/login`；已登录→`router.replace(/user/{id})`（保留 query 透传 tab 映射：library→资料库、favs→收藏、orders→订单、notif→通知） |
| `/creator/[id]`   | server component `redirect(\`/user/${id}\`)`（308 永久）                                                                                            |
| `/creator-center` | 删除页面；`redirect` 至 `/user/{self}?tab=works`（客户端）                                                                                          |
| `/income`         | 删除页面；`redirect` 至 `/user/{self}?tab=income`（客户端）                                                                                         |
| `/following`      | **保留**（关注动态信息流独立页）                                                                                                                    |

`src/components/chrome/Nav.tsx` 下拉精简为：

```
{username} · 学院
────────────────
👤 个人主页        → /user/{id}
📤 发布作品        → /upload
🔔 通知中心 (N)    → /user/{id}?tab=notif
────────────────
🚪 退出登录
（role=ADMIN 额外显示：🛡 管理后台 → /admin）
```

其他引用清理：全局 grep `creator-center`、`/income`、`/me?tab`、`/creator/` 更新（上传成功跳转→`/user/{self}?tab=works`；WorkDetailClient 作者卡跳转→`/user/{author.id}`；排行榜/rank 卡、CreatorCard、DynamicCard、搜索结果跳转同步改）。

### 5.6 改动清单

| 文件                                                 | 改动                 |
| ---------------------------------------------------- | -------------------- |
| `prisma/schema.prisma` + 迁移                        | User.bio / avatarKey |
| `src/app/api/v1/users/**`（6 个 route）              | 新增                 |
| `src/app/api/v1/me/profile/route.ts`、`avatar`       | 新增                 |
| `src/app/api/v1/creators/**`                         | 删除                 |
| `src/server/auth/session.ts` buildAuthUser 相关      | bio/avatarUrl        |
| `src/middleware.ts`                                  | users GET 公开       |
| `src/app/(site)/user/[id]/page.tsx` + 子组件         | 新增主页             |
| `src/components/form/EditProfileModal.tsx`           | 新增                 |
| `/me`、`/creator/[id]`、`/creator-center`、`/income` | 收编跳转/删除        |
| `Nav.tsx` 及全部旧路由引用                           | 精简 + 替换          |
| `src/hooks/useCreator.ts`、`useSocial.ts` 等         | 端点替换             |

### 5.7 测试清单

- [ ] typecheck / lint / test；新增集成：
  - [ ] `GET /users/{id}` 返回 stats 与 isSelf/myFollow 正确（匿名/本人/他人三态）
  - [ ] follows：follow 三人后 followers 列表含关注者、following 正确、分页生效
  - [ ] `PATCH /me/profile`：改名成功；重名→USERNAME_TAKEN；bio 超 200→400
  - [ ] `POST /me/avatar` 指向不存在对象→400
- [ ] 手动：`/me`、旧 `/creator/xxx`、旧上传成功跳转全部落到新主页对应 tab；Nav 下拉只有精简后入口
- [ ] 手动：编辑资料改名/传头像/改简介即时生效（Nav 头像同步变）；头像删除 MinIO 对象后回退色块
- [ ] 手动：本人作品 tab 空态出现「去发布」按钮且跳 `/upload`；发布后回到该 tab 看到带审核中角标
- [ ] 手动：收益 tab 提现流程（mock 支付）走通；订单/收藏/资料库/通知各 tab 数据正确

---

## V3-6 举报闭环

### 目标

举报从「假按钮+裸表格」升级为完整闭环：多入口举报（作品/评价/评论/用户）→ 内容快照 → 聚合队列（显示举报人数与举报人）→ 处置联动（下架/封号/删评/驳回）→ 双向通知（举报人+被处置方）→ 我的举报状态。**不做侵权退款**（决策 2 明确）。

### 6.1 数据模型

```prisma
enum ReportStatus {
  OPEN
  PROCESSING
  RESOLVED
  DISMISSED   // 新增：驳回（不属实）
}

model Report {
  // ...
  targetTitle    String?   // 快照标题（作品标题/评论前 30 字/用户名）
  targetSnapshot Json?     // 快照：{title?, desc?, content?, username?, workTitle?, authorName?, workStatus?}
  targetAuthorId String?   // 被举报内容作者（WORK/COMMENT 时冗余，USER 时=targetId），处置联动用
}
```

迁移 `v3_report_snapshot_dismissed`。

### 6.2 服务端（`report.service.ts`）

**create** 增强：

1. **幂等**：同 reporterId + targetType + targetId 且 status ∈ {OPEN, PROCESSING} 已存在 → `CONFLICT '你已举报过该内容，请等待处理'`（放在限流之后）。
2. **快照生成**（按 targetType 查库）：
   - WORK：`{title, desc: description 前 200 字, workStatus, authorName, authorId}`；作品不存在→NOT_FOUND
   - COMMENT：`{content, workTitle, authorName, authorId}`；已删→NOT_FOUND
   - USER：`{username, bio}`；targetAuthorId=targetId
3. 落库带 targetTitle/targetSnapshot/targetAuthorId。5 次/小时限流保留。

**新增 `myReports(userId)`**：本人举报列表（倒序）：`{id, targetType, targetId, targetTitle, reason, detail, status, handleNote, createdAt, handledAt}`。

**adminList 改聚合**（`?status=` 可选过滤，默认全部）：

```
GET /api/v1/admin/reports → { data: [{
  targetType, targetId, targetTitle, snapshot,
  count,                                  // 举报人数
  reporters: [{username, reason, detail, at}],   // 明细（含每个举报人）
  reasons: [{reason, n}],                 // 原因分布
  latestAt, openCount,
  status,                                  // 该 target 下最新状态（任一 OPEN→OPEN）
}], total }
```

实现：`groupBy(targetType, targetId)` 取组，再查组内明细（组数有限，无性能问题）。

**adminHandle 改为按 target 处置**（替换现有按 reportId 的端点）：

```
POST /api/v1/admin/reports/handle
body: {
  targetType, targetId,
  action: 'RESOLVE' | 'DISMISS',
  note?: string,                           // 处理备注（必填当 action=DISMISS）
  measures?: { takedownWork?: boolean, deleteComment?: boolean, banUser?: boolean, banReason?: string }
}
```

事务内：

1. 该 target 的全部 OPEN/PROCESSING 举报 → `RESOLVED`/`DISMISSED` + handlerId/handledAt/handleNote。
2. measures 联动（RESOLVE 时可选）：
   - `takedownWork`：`work.status = TAKEN_DOWN` + 写 `AuditLog{action: TAKE_DOWN, note: '举报处置'}` + 通知作者（NotificationType.AUDIT_RESULT）「作品《{title}》因举报核实已被下架：{note}」。
   - `deleteComment`：评论软删 + 通知评论作者（SYSTEM）。
   - `banUser`：封禁 targetAuthorId（复用 adminService 封号逻辑，bannedReason 必填）。
3. 通知所有举报人（SYSTEM）：「你的举报已处理：{targetTitle} —— {已下架/已删除/用户已封禁/未违规驳回}」。

**路由**：`/admin/reports`（GET 聚合）、`/admin/reports/handle`（POST）；**删除** 旧 `/admin/reports/[id]`。

### 6.3 前端

**ReportModal**（`src/components/form/ReportModal.tsx`，通用）：

- props：`{targetType, targetId, targetTitle}`。
- 原因单选（6 项，含说明）：

| 枚举                | 文案     | 说明                        |
| ------------------- | -------- | --------------------------- |
| INFRINGEMENT        | 侵权盗用 | 抄袭、盗用他人原创资料      |
| PIRACY              | 盗版资源 | 上传付费课程/书籍等盗版内容 |
| MISMATCH            | 货不对板 | 内容与标题简介严重不符      |
| PORN_GAMBLE_ILLEGAL | 违法违规 | 色情、赌博、诈骗等违法信息  |
| SPAM                | 垃圾广告 | 广告刷量、无关内容          |
| OTHER               | 其他     | —                           |

- 补充说明 textarea（≤600，选填）+ 提交。成功 toast「已收到举报，我们会尽快核实」。CONFLICT 时 toast 原文案。

**入口接线**：

- `WorkDetailClient` 现有「··· 举报」假按钮 → 打开 ReportModal（targetType WORK）。
- `ReviewItem` 加「···」菜单 → 举报该评价（targetType WORK，targetId=workId，注明举报对象是某条评价 → 快照含该评价内容：**扩展**：评价也走 COMMENT 型？**定稿**：评价举报 targetType=COMMENT 复用（targetId=ratingId 亦可）→ 为避免混淆，**新增 targetType 枚举值 RATING**（migration 同 6.1 一起），快照取 `{content: text, stars, workTitle, authorName}`，处置 deleteComment 语义对 RATING 为删除该评价。
- 评论项（作品评论）→ targetType COMMENT。
- `/user/[id]` hero 操作区「⋯举报」→ targetType USER。

**我的举报 tab**（`/user/[id]?tab=reports`）：`GET /me/reports` 列表：目标（可点跳转，作品/用户可跳，评论跳所属作品）+ 原因徽章 + 我填的说明 + 状态徽章（待处理 OPEN / 处理中 / 已处置 RESOLVED / 已驳回 DISMISSED）+ handleNote + 时间。

**管理端 reports tab 重做**（`admin/page.tsx`）：

- 聚合卡列表：每卡 = 类型徽章 + targetTitle + 快照摘要（描述/评论内容前 100 字）+ 「N 人举报」+ 原因分布 chips + 举报人 username 列表（含各自时间）+ 最新时间 + 状态。
- 操作按钮 → 处置 Modal：单选结果（处置有效 / 驳回）+ 措施复选（下架作品 / 删除评论或评价 / 封禁用户[需填原因]）+ 备注 → 提交 `handle`。
- 顶部状态过滤（待处理 / 已处置 / 已驳回）。

### 6.4 改动清单

| 文件                                                     | 改动                             |
| -------------------------------------------------------- | -------------------------------- |
| `prisma/schema.prisma` + 迁移                            | 快照字段 + DISMISSED + RATING    |
| `src/server/services/report.service.ts`                  | 幂等/快照/聚合/处置联动/我的举报 |
| `src/app/api/v1/reports/route.ts`                        | create 透传新错误                |
| `src/app/api/v1/me/reports/route.ts`                     | 落地（替换 V3-5 占位）           |
| `src/app/api/v1/admin/reports/**`                        | 聚合 + handle 新端点，删旧       |
| `src/components/form/ReportModal.tsx`                    | 新增                             |
| `WorkDetailClient` / `ReviewItem` / 评论组件 / user 主页 | 入口接线                         |
| `src/app/(site)/user/[id]/page.tsx`                      | 我的举报 tab                     |
| `src/app/(site)/admin/page.tsx`                          | reports tab 重做                 |
| `src/lib/constants.ts` / zod                             | 枚举字典同步                     |

### 6.5 测试清单

- [ ] typecheck / lint / test；新增集成：
  - [ ] 举报作品：快照落库正确；同用户重复举报→409；不同用户可各自举报
  - [ ] 聚合：同 target 三人举报（不同原因）→ count=3、reporters 3 人、reasons 分布正确
  - [ ] RESOLVE + takedownWork：作品 status→TAKEN_DOWN、AuditLog 生成、作者与 3 个举报人各收到通知、举报全部 RESOLVED
  - [ ] DISMISS：需 note、举报转 DISMISSED、无处置动作
  - [ ] banUser：被举报作者 status→BANNED
- [ ] 手动：作品/评价/评论/用户四个入口均能弹 Modal 提交；管理端聚合卡信息完整、处置全流程走通、我的举报 tab 状态与备注可见
- [ ] 手动：重复举报 toast 提示正确；限流 6 次/小时第 6 次被拒

---

## V3-7 新生专区（开学季运营位）

### 目标

首页靠前位置（免费推荐之前）呈现新生专区横幅，内容导向「大学引路」而非学习资料；feature flag 控制，开学季结束后一键下线。

### 7.1 开关

`.env` / `.env.example` 新增：`NEXT_PUBLIC_FRESHMAN_ZONE=on`（前端读 `process.env.NEXT_PUBLIC_FRESHMAN_ZONE !== 'off'`，默认开）。10 月运营结束后改 `off` 重启即隐藏，无代码改动。

### 7.2 首页横幅

`src/app/(site)/page.tsx` 校园专区视图内，**专区导航（zone-nav）之下、关注动态之上**插入 `<FreshmanBanner />`（新组件 `src/components/home/FreshmanBanner.tsx`）：

```
┌──────────────────────────────────────────────────────────────┐
│ 🎓 你好，2026 级新同学                                         │
│    报到、选课、军训、宿舍——学长学姐把路都替你踩过了              │
│  [选课攻略] [报到流程] [军训生存] [宿舍生活] [社团指南]          │
│  [校园地图] [开学考试] [英语分级] [更多 →]                       │
│ ┌─────────────┐ ┌─────────────┐                               │
│ │ 热门引路作品×2│ │             │  ← 右侧两张 mini 卡            │
│ └─────────────┘ └─────────────┘                               │
└──────────────────────────────────────────────────────────────┘
```

- 视觉：暖色渐变底（`--pri-50`→`--pri-100` 系）、圆角 16、左侧文案右两卡；新增 `.freshman-banner` 样式组（globals.css），移动端纵向堆叠。
- chips：`PRESET_TAGS.CAMPUS` 前 7 项 + 「更多 →」（跳 `/explore?cat=CAMPUS`）；chip 点击跳 `/explore?cat=CAMPUS&tag={chip}`。
- 右侧 mini 卡：`useWorks({category:'CAMPUS', sort:'hot', pageSize:2})` 取热门引路作品（简版 FineCard 或专用 mini 卡：封面+标题+观看量）。
- flag off 时整块不渲染（含数据请求）。

### 7.3 种子内容（引路向，不放学习资料）

`prisma/seed.ts` 新增 8 个 CAMPUS 作品（isFree、PUBLISHED，配真实文件对象如 V3-3），示例：

1. 深大选课全攻略：通识课红黑榜与抢课技巧（tags: 选课攻略）
2. 英语分级考经验：题型与复习重点（英语分级/开学考试）
3. 军训生存指南：物品清单与防暑贴士（军训生存）
4. 丽湖/粤海宿舍全对比：床位、卫浴、外卖点（宿舍生活）
5. 社团怎么选：百团大战避坑指南（社团指南）
6. 校园地图使用版：教学楼/食堂/快递点标注（校园地图）
7. 新生报到一天流程：材料清单与时间线（报到流程）
8. 转专业政策与经验帖（转专业）

作者分配给现有种子创作者；同时给演示账号收藏/下载其中 2 个，保证首页数据丰满。

### 7.4 测试清单

- [ ] typecheck / lint / test；seed 测试行数断言更新（20→28 作品）
- [ ] 手动：横幅出现在关注动态之前；chips 跳转 explore 过滤正确；mini 卡点击进详情
- [ ] 手动：`NEXT_PUBLIC_FRESHMAN_ZONE=off` 重启后横幅消失、无多余请求
- [ ] 手动：375px 宽度下横幅纵向堆叠不溢出

---

## V3-8 回归验收与收尾

### 8.1 代码级回归

- [ ] `pnpm typecheck && pnpm lint && pnpm test` 全绿（含各阶段新增集成测试）
- [ ] `pnpm test:e2e`：更新 `e2e/` 用例——核心路径补充：首页→explore 分类→作品；作品→在线预览打开；发布流程（登录→上传 PDF→封面→提交→个人主页作品 tab 可见带审核角标）；举报提交→管理端可见。旧断言中 `/creator/`、`/me` 路径改为 `/user/` 并断言 308/302 跳转生效。
- [ ] `grep -rn 'requireCreator\|creator-center\|/api/v1/creators' src/` 为 0 处残留（除 redirect 兼容代码与文档）

### 8.2 全站手动回归清单（上线前走一遍）

1. 注册→登录→发布 PDF 免费作品（自动封面）→管理端审核通过→首页/分类页可见→预览计观看量
2. 发布付费作品（试读副本）→另一账号试读 5 页+水印→购买→全量预览+下载→评价
3. 个人主页各 tab（本人 10 tab/他人 4 tab）、编辑资料、头像上传、关注/粉丝列表
4. 举报四入口→管理端聚合→处置（下架+封号）→双向通知→我的举报状态
5. 新生专区横幅→explore CAMPUS 过滤
6. 管理后台其余 tab（作品审核/提现/认证/用户）不回归损坏
7. 支付 mock 链路（下单→支付→收益→提现）不回归损坏
8. 375 / 768 / 1440 / 1920 四档宽度目测无破版

### 8.3 文档收尾

- `docs/API_CONTRACT.md`：追加 V3 变更（users/* 六端点、preview、cover/avatar 302、reports 聚合与 handle、works category/courses；删除 creators/*；views 语义注明）。
- `docs/PROGRESS.md`：V3-1~V3-8 每阶段条目（已在各阶段守则要求，此处核对齐全）。
- `.env.example`：`NEXT_PUBLIC_FRESHMAN_ZONE=on` 注释说明。
- 根目录 `.shot.mjs` 截图脚本更新：增加 `/explore`、`/user/{demo}`、预览打开态三张截图，供最终验收目测。

---

## 附录 A 分类与标签池全表（权威）

见 §2.2 代码块。任何界面出现的大类名/图标/标签文案以该表为准；调整须经产品确认后同步常量与 seed。

## 附录 B API 变更汇总

| 变更 | 端点                                                                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 新增 | `GET /works/courses?category=`                                                                                                                 |
| 新增 | `POST /works/[id]/preview`（匿名可访问）                                                                                                       |
| 新增 | `GET /works/[id]/cover`（302，公开）                                                                                                           |
| 新增 | `GET/POST /users/[id]`、`/users/[id]/works`、`/users/[id]/ratings`、`/users/[id]/follows`、`POST /users/[id]/follow`、`GET /users/[id]/avatar` |
| 新增 | `PATCH /me/profile`、`POST /me/avatar`、`GET /me/reports`                                                                                      |
| 新增 | `GET /admin/reports`（聚合）、`POST /admin/reports/handle`                                                                                     |
| 修改 | `GET /works`（+category）、作品创建（+category/coverKey/previewKey）、presign（+kind）                                                         |
| 删除 | `/creators/[id]`、`/creators/[id]/stats`、`/creators/[id]/works`、`/creators/[id]/follow`、`/admin/reports/[id]`                               |

## 附录 C Schema 变更汇总（3 次迁移）

1. `v3_add_category`：`Category` enum + `Work.category`
2. `v3_add_cover_preview_key`：`Work.coverKey` + `Work.previewKey`
3. `v3_user_bio_avatar` + `v3_report_snapshot_dismissed`（可合并为一次 `v3_user_and_report`）：`User.bio`、`User.avatarKey`、`Report.targetTitle/targetSnapshot/targetAuthorId`、`ReportStatus.DISMISSED`、`ReportTargetType.RATING`

## 附录 D 总验收清单（8 问映射）

| 原始问题   | 验收标准                                                                                           | 阶段   |
| ---------- | -------------------------------------------------------------------------------------------------- | ------ |
| 1 边距过大 | 1440 屏两侧空白 ≤24px；1920 屏内容 ≥1472px；宽屏 5 列                                              | V3-1   |
| 2 举报机制 | 四入口可举报；管理端聚合显示人数+举报人；处置联动+双向通知；我的举报可查                           | V3-6   |
| 3 个人主页 | `/user/[id]` 承载全部 10 类内容；编辑资料/头像；空作品态可跳发布；所有旧路由收编；无认证门槛可发布 | V3-2+5 |
| 4 预览     | 免费 PDF 全量在线预览；点击才算观看；免费作品展示观看量；付费试读 5 页+水印；非 PDF 有明确引导     | V3-3+4 |
| 5 新生专区 | 首页靠前横幅；chips 跳转过滤；内容为引路类；flag 可下线                                            | V3-7   |
| 6 分类     | 一级用途 6 大类、二级标签/课程；explore 页全维度筛选；上传必选大类                                 | V3-2   |
| 7 封面     | PDF 自动首页缩略；可选图标配色或自定义上传；全站卡片渲染图片封面、失败回退                         | V3-3   |
| 8 进度条   | 评分分布 5 行渐变进度条可见                                                                        | V3-1   |
