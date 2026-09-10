# V11「读得顺」前端改版计划

> 2026-09-10 与用户讨论定稿。三项需求：电脑端 home 键、新生区分类就地筛选、资料详情页论文式重排。
> 设计上下文见根目录 `PRODUCT.md`（product register）。手机端为一等公民，每个功能先按 390px 设计再放大。

---

## 已确认的设计决策

| 决策点       | 结论                                                                                 |
| ------------ | ------------------------------------------------------------------------------------ |
| 返回痛点场景 | 电脑端（手机已有底部 tabbar 首页，线上已验证）                                       |
| 详情页版式   | 左主右辅（论文站式）：标题横贯顶部，左列=摘要+内嵌预览+评价，右列=文件卡+下载+作者   |
| 在线预览形态 | 内嵌页面为主：进页面自动展示前 30%，点「展开全文」前端展开剩余；全屏弹窗保留为可选项 |
| 标题字体     | 保持全站无衬线（Plus Jakarta Sans / Noto Sans SC），一致性优先                       |
| 手机端操作   | 详情页底部常驻操作条 [首页 \| 预览 \| 下载]，本页隐藏底部 tabbar                     |
| 新生区 chips | 就地筛选：点分类按钮 → 下方 3 条资料行切换，不跳页                                   |
| 封面处理     | 详情页去大封面，改右栏文件信息卡（列表页封面照旧）                                   |

## 现状问题清单（改版依据）

1. 阅读顺序反了：标题/下载在右栏，左栏首屏是 160px 装饰封面（emoji 大字+水印）
2. `work.description`（简介）在详情页**完全没有渲染**——想看资料讲什么只能回列表页
3. 预览是弹窗优先 + ▶ 播放按钮入口条 + 「观看次数」挂帅 = 视频平台感
4. 徽章堆叠（免费/精品/精选/评分/热度）互相抢注意力
5. 桌面顶栏无独立「首页」入口（只有 logo）
6. 「← 返回」是裸 `router.back()`：新标签页/分享链接直接打开时无历史，点了没反应

---

## 一、电脑端首页入口 + 返回兜底

**改动文件：**

- `src/lib/icons.tsx`：PATHS 补 `home`（取 MobileNav 现成的房屋 SVG path）
- `src/components/chrome/Nav.tsx`：`nav-actions` 内、`发布作品` 之前加 `<Link className="nav-link" href="/">首页</Link>`（带 icon）。≤980px 时随其他 nav-link 隐藏，手机走底部 tabbar 不受影响
- 新 `src/lib/nav.ts`（client util）：

```ts
export function backOrHome(router: AppRouter, fallback = '/') {
  if (window.history.length > 1) router.back();
  else router.push(fallback);
}
```

- 替换所有裸 `router.back()` 调用点：`WorkDetailClient.tsx`、`settings/page.tsx`、`ops/{works,users,orders}/page.tsx`（grep 确认无遗漏）

**验收：** 桌面任意页面一步回首页；新标签页打开 `/work/xxx` 点「← 返回」落到首页。

## 二、新生区分类 chips 就地筛选

**改动文件：** `src/components/home/FreshmanZone.tsx` + `globals.css`

- chips 由 `Link → /explore?...` 改为 `<button>`；行首加「全部」chip（默认选中）
- `useState` 选中 tag；行数据 `useWorks({ category: 'CAMPUS', tag: tag==='all'?undefined:tag, sort: 'complex', pageSize: 3, isFree: true })`——react-query 按参数缓存，切换即时出（该 tag 首次点选有一次加载态）
- 切换后若 `.fresh-rows` 不在视口内，`scrollIntoView({ behavior:'smooth', block:'nearest' })`
- 该 tag 无资料：行区显示小空态「该分类暂无资料，看看全部吧」
- CSS：`.fchip` button 样式对齐原 Link、新增 `.fchip.on` 选中态；行切换 150ms fade（`prefers-reduced-motion` 下关闭）
- 底部「查看新生专区全部资料 →」保留跳 explore（全量列表仍需列表页承担）

**验收：** 点「军训」页面不跳转，下方行变为军训类；点「全部」还原。

## 三、资料详情页论文式重排（大头）

### 3.1 桌面结构（≥1100px）

```
page-head:  ← 返回 + 面包屑（首页 / 课程 / 标题）     ← 右侧按钮组撤走
────────────────────────────────────────────────
标题块（横贯）:
  h1  26px / 800 / text-wrap: balance
  byline: [28px 头像] 作者名(link) · 学院 · MM-DD 收录 · ⭐4.9(12)
  小字统计: 👁 2.1k · ⬇ 89 · ♡ 45    + 单个徽章（免费 / 💎精品）
  tags 行（超宽可横滑）
────────────────────────────────────────────────
.wd-body  grid: minmax(0,1fr) 300px, gap 32px
  左列（主）:                      右列（辅, sticky top 84px）:
    ① 简介卡                        文件卡: 📄 PDF · 12.4MB · 86页
       「简介」+ description 全文     [⬇ 下载] btn-block 主按钮
       meta 行: 课程 · 适用 · 适合    [♡ 收藏] [♥ 点赞] 并排
    ② 预览区（内嵌）                 分享 · 举报 小链接行
       区头「预览」+ [⛶ 全屏]       ────────────
    ③ 用户评价                      作者卡（现有 trust-card 简化）
    ④ 相关推荐（FineCard）
```

- 管理员审核条保留在 page-head 下方原位
- **删除**：`.wd-cover` 大封面、`preview-entry` 播放条、右栏 info-card 的热度/课程/适用/标签行式罗列、page-head 右侧按钮组
- 徽章只留一个；「平台精选/高评分」降为 byline 小字或删

### 3.2 内嵌预览组件（新 `src/components/work/WorkPreviewInline.tsx`）

- MD：marked + DOMPurify 渲染；`renderMd` 从 PreviewModal 抽到 `src/lib/md.ts` 共享；阅读容器 `.wd-reader` 按 65-75ch、16px/1.8 排版
- **进页面即展示前 30%**：预览区进入视口时（IntersectionObserver）POST `/works/:id/preview` 一次，MD 渲染出前 ~30%（在标题/段落边界截断），底部渐隐 + 「展开全文」按钮。**展开是纯前端切换，不发第二次请求**（免费模式服务端一次就回全文）
- 浏览计数安全：该端点计数为同人/同 IP **24h 去重**（SETNX 成功才 INCR），自动加载 = 每人每天至多 +1，语义即「浏览」，不虚增；限流 30 次/分也远够
- PDF：iframe 内嵌（高 `min(70vh, 640px)` 自带滚动），同样进视口自动加载；浏览器 PDF 查看器按需 range 请求，不整包下载
- sample 模式（付费未购）：服务端本来就回试读副本（PDF 前 5 页 / MD 前 30%），尾部 CTA 是「解锁完整版」→ OrderModal（不是展开）
- mode=none（DOCX 等）：「该格式暂不支持在线预览，下载后查看」
- 「⛶ 全屏」→ 复用现有 PreviewModal（保留）
- 失败：toast + 预览区显示轻量错误态与「重试」

### 3.3 手机端（<680px）

- 单列顺序：标题块 → 简介卡 → 文件信息行（紧凑横排）→ 预览区 → 评价 → 作者卡 → 相关推荐
- **底部常驻操作条** `.wd-actionbar`：fixed bottom，`[🏠] [▶ 预览] [⬇ 下载（flex-1 主按钮）]`；含 safe-area-inset-bottom；主内容 padding-bottom 预留高度
- 本页隐藏 `.mobile-tabbar`（避免双层底栏）：WorkDetailClient 挂载时给 `document.body` 加 `work-detail-page` 类、卸载移除；CSS `.work-detail-page .mobile-tabbar { display: none }`
- **CSS 级联教训（V10.3 踩过）**：移动端媒体查询规则必须写在对应 base 规则之后，防同优先级被覆盖

### 3.4 改动文件汇总

| 文件                                            | 动作                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `src/app/(site)/work/[id]/WorkDetailClient.tsx` | 重写布局结构                                                         |
| `src/components/work/WorkPreviewInline.tsx`     | 新建                                                                 |
| `src/lib/md.ts`                                 | 新建（renderMd 抽出共享）                                            |
| `src/components/work/PreviewModal.tsx`          | 改为引 lib/md，逻辑不动                                              |
| `src/styles/globals.css`                        | `.wd-*` 新布局 + `.wd-reader` + `.wd-actionbar` + 移动端规则（后置） |
| `src/lib/icons.tsx`                             | 补 home 图标（一并用）                                               |

## 四、测试适配

- `e2e/paths.spec.ts`：预览入口文案与结构变化——用例 7/9 的「在线预览」选择器改指「开始阅读」/预览区；下载按钮位置变化适配
- 门禁：`pnpm typecheck && pnpm lint && pnpm test`

## 五、实施顺序与提交切分

| #   | 提交                                    | 内容                                                                          |
| --- | --------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | `docs: V11 计划与 PRODUCT.md`           | 本文档 + PRODUCT.md                                                           |
| 2   | `feat(nav): 桌面顶栏首页入口与返回兜底` | Nav + icons + backOrHome + 各页替换                                           |
| 3   | `feat(home): 新生区分类按钮就地筛选`    | FreshmanZone + CSS                                                            |
| 4   | `feat(work): 详情页论文式重排`          | 结构重写 + WorkPreviewInline + CSS（桌面+手机一次到位，避免中间态双端不一致） |
| 5   | `test(e2e): 详情页改版适配`             | e2e 选择器                                                                    |

每步本地 `pnpm dev` + Playwright 截图（iPhone 13 视口 + 1440 桌面）自查后再下一步；详情页完成后用 impeccable 流程跑一轮 critique/polish（对比度、触摸目标、动效时长）。

## 六、验证与部署

1. 本地门禁全绿 → 桌面/手机截图对照「验收清单」
2. 部署走现有管线：commit → push GitHub → `git bundle create <file> <ref>`（**必须带 ref 名**）→ scp -O → 服务器 fetch + ff → `build --no-cache app` → `up -d --no-deps app`
3. 部署后：`bash scripts/smoke-prod.sh https://kedahub.cn` 35/35 + 生产双端截图
4. 回滚：纯前端提交，`git revert` + 重建即回，无数据风险

## 七、验收清单

- [ ] 桌面任意详情页一步可达首页（顶栏「首页」）
- [ ] 新标签页打开详情页，「← 返回」落到首页（兜底生效）
- [ ] 新生区点「军训」不跳页、下方行切换；「全部」还原
- [ ] 详情页首屏左上是标题+作者+简介，无大封面无播放按钮
- [ ] 进页面预览区自动显示前 30%（MD 渲染 / PDF 翻页）；「展开全文」即时展开、可收起；全屏可选
- [ ] 手机端底部常驻 [首页|预览|下载]，与 tabbar 不叠加
- [ ] smoke 35/35
