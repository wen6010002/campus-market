# V10 前端改版 — 资料博客式列表（Blog Redesign）

> 状态：设计已定稿（模拟稿 `/tmp/cm-home-redesign.html` + `/tmp/cm-list-redesign.html` 方向①），本文档为实施与上线流程。
> 性质：**纯前端改动** —— 无 Prisma 迁移、无 API 变更、无 env 变更、无数据回填。

## 1. 目标与范围

把「卡片网格」形态全面切换为「资料博客」形态：刊头 + 目录式列表（日期左列 + 橙色眉题 + 标题摘要 + meta）+ 右侧栏。

| 阶段         | 页面                                                   | 改动                                                                                      |
| ------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 一期（本次） | 主页 `/`                                               | 整页重写：masthead 刊头 / 新生特辑 / 最新上架(hero+时间流) / 编辑推荐 / 官方路线图 / 侧栏 |
| 一期（本次） | 分类浏览 `/explore`                                    | 卡片网格 → 目录页列表（分页保留）                                                         |
| 二期（另起） | `/search`、用户主页作品 tab、路线图详情内嵌            | 换用 FeedRow 组件（复用一期产物，视觉即统一）                                             |
| 不动         | `/work/[id]` 详情、相关推荐（FineCard）、后台 ops 全部 | 保持现状，`.work-card`/`.card-grid` 样式保留                                              |

一期完成后主页与 explore 为新形态，search/user/roadmap 详情页短暂保留旧卡片——详情页内嵌小卡属合理形态，视觉不冲突（已在模拟稿评审中确认方向②③可并存）。

## 2. 功能映射表（旧 → 新）

| 现有功能                           | 去向                                 | 备注                                                                                                                                          |
| ---------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| zone-nav 专区切换（校园/自我提升） | **退役**                             | V7 免费化后语义已弱化；新设计用分类 chips 替代。`?zone=growth` 参数保留解析但不再切换视图（防外链 404）。Nav 顶栏无 zone 入口，已核实不受影响 |
| cat-quick 分类 chips               | 刊头下分类行（`.cats`）              | 沿用 CATEGORIES 顺序，选中态墨色                                                                                                              |
| FreshmanBanner 新生横幅            | FreshmanZone 新生特辑块              | 沿用 `FRESHMAN_ZONE_ENABLED` flag 语义（off 时整块不渲染不发请求）；chips 逻辑沿用（仅显示有真实作品的标签）                                  |
| 今日免费推荐 card-grid             | 编辑推荐区（emoji 块左列）           | 数据源不变 `sort:'complex'`；ABROAD 排除逻辑延续                                                                                              |
| —（新增）                          | 最新上架 hero + 时间流               | `useWorks({ sort:'new' })`，第一条放大 hero，余下 FeedRow                                                                                     |
| HomeRoadmapBanner 渐变横幅         | 官方路线图紧凑行区                   | 复用 `useRoadmaps({sort:'favs'})`，横滑卡片改 `.rm-row` 紧凑行                                                                                |
| 排行榜（4 tab）                    | 侧栏 SideRank                        | 交互不变                                                                                                                                      |
| —（新增）                          | 侧栏公告                             | 公开 API `GET /api/v1/announcements?pageSize=2` 已存在，直接用                                                                                |
| —（新增）                          | 侧栏分类目录带计数                   | 抽 `useCategoryCounts` hook（explore 现有并行 count 逻辑迁移复用）                                                                            |
| 关注动态 follow-strip              | 保留，位置在分类行下、新生特辑上     | DynamicCard 不动                                                                                                                              |
| 免费推荐/精品分区语义              | pill 徽章（免费=mint / 精品位=fine） | `FREE_MODE` 构建期开关继续生效：off 时仍显示价格                                                                                              |

### 已确认的数据约束

- **masthead 统计**：「共收录 N 份」用 `useWorks({pageSize:1})` 的 total；「本周新增」API 无时间范围过滤，一期砍掉不显示（避免为装饰数字加后端参数）。
- **最新上架 excludeCat ABROAD 延续**（启动期留学不进首页主流，侧栏分类入口可达）。
- **React Query 纪律**：沿用现有 queryKey，不改返回结构（`['works','tags',cat]` 必须保持原始数组——V8 缓存投毒事故复盘）。

## 3. 新增组件与样式

### 组件（src/components/）

| 文件                    | 职责                                                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `work/FeedRow.tsx`      | 通用目录行，props 带 `variant: 'feed' \| 'hero' \| 'rec' \| 'compact'`；feed=日期左列、rec=emoji 块左列、compact=路线图行。外层 Link 保留 Next 预取 |
| `home/Masthead.tsx`     | 刊头（kicker/大标/tagline/统计）+ 分类行                                                                                                            |
| `home/FreshmanZone.tsx` | 新生特辑块（chips + 3 条序号行 + 底部入口）；导出 `FRESHMAN_ZONE_ENABLED` 保持页面引用不动                                                          |
| `home/LatestFeed.tsx`   | 最新上架：hero 首条 + FeedRow 时间流 + 「加载更早」翻页（page state，沿用 apiFetchPage）                                                            |
| `home/EditorPicks.tsx`  | 编辑推荐（3-6 条 rec 变体）                                                                                                                         |
| `home/RoadmapStrip.tsx` | 官方路线图紧凑行（替代 HomeRoadmapBanner 的渲染层，数据 hook 复用）                                                                                 |
| `home/SideColumn.tsx`   | 侧栏聚合：SideRank（4 tab）+ 公告 + 分类目录                                                                                                        |

### 样式（src/styles/globals.css 追加）

- 新类前缀：`.mast-*` `.cats` `.cat-chip` `.fresh-*` `.f-row` `.f-no` `.feed-*` `.hero-*` `.rec-*` `.rm-row` `.side-*` `.rank-*` `.note-*`，从模拟稿 CSS 逐条移植。
- **旧类不删**（`.work-card` `.fine-card` `.card-grid` `.fine-grid` `.zone-nav` 等）：详情页/搜索页/用户页仍在用；删除留给二期收尾。
- 响应式断点：`960px` 侧栏落底、`640px` 目录行单列（序号/箭头/日期列收起）；全部放进现有 media query 区域。
- `prefers-reduced-motion` 下关闭 hover 位移过渡（模拟稿已写，随迁）。

## 4. 实施步骤（本地 /tmp/cm-plan）

### Phase 0 — 同步基线

1. `git fetch` 服务器远端并确认本地 = 服务器 main（当前 e6937a7）；若 peer 会话有新提交先 merge 再动手。

### Phase 1 — 组件与样式落地

2. globals.css 追加全部新类（一次性提交，纯 CSS 无逻辑）。
3. 实现 `FeedRow.tsx` + 各 home 组件；主页 `page.tsx` 重写；删除主页对 WorkCard/FineCard/DynamicCard 之外旧区块的引用（follow-strip 保留）。
4. `FreshmanBanner.tsx` 整文件替换为 `FreshmanZone`（文件名与导出名保持 `FreshmanBanner`，减少 import 面积——或改名并同步 page import，二选一以 diff 小者为准）。
5. `HomeRoadmapBanner.tsx` 渲染层替换为 RoadmapStrip 内容（数据 hook 不动）。

### Phase 2 — explore 换装

6. explore 主区 `card-grid` → FeedRow 列表（feed 变体，保留左侧分类 aside、标签/课程/排序工具栏全部逻辑不动，仅替换渲染层）。
7. e2e 修复：`e2e/paths.spec.ts:136` `.work-card` 与 `:145` `.card-grid .work-card` 两条选择器改指 `.feed-row`（用例语义不变）。

### Phase 3 — 本地验证

8. `pnpm typecheck && pnpm lint`。
9. `pnpm build`（确认 FREE_MODE=off 下无价格残留、无 SSR 报错）。
10. dev 起本地，桌面+移动视口人工过一遍验收清单（§6）。
11. e2e 跑通（`pnpm e2e`，dev 库——注意测试库安全开关，跑前确认 .env 指向 dev 库）。

### Phase 4 — 提交与部署

12. 分两个 commit：`feat(ui): 博客式列表组件与全局样式`（Phase 1 CSS+组件）、`feat(home): 主页与 explore 切换资料博客形态`（页面重写+e2e），便于回滚粒度。
13. git bundle 推服务器：`fetch + merge`（**绝不 reset**），服务器 `main` 前进。
14. 服务器构建：`docker compose -f docker-compose.prod.yml build --no-cache app`。
15. `up -d app`（只起 app，不动 cm-postgres/pgbouncer/redis/minio——避免跨项目容器名抢占事故重演；compose 插值所需 docker/.env 已就位不动）。
16. 立即跑 `scripts/smoke-prod.sh` + 本文档 §6 线上验收清单。

## 5. 线上保障设计（为什么不会出线上问题）

| 风险                   | 对策                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------- |
| 数据/后端回归          | 本次零后端改动、零迁移、零 env；部署仅替换 app 镜像静态资源与 RSC 产物             |
| 部署期抖动             | 选低峰窗口（避开 21:00-24:00 访问高峰；建议上午）；build 完成后才 up，切换间隙秒级 |
| 容器名抢占（历史事故） | 只 `up -d app`，不触碰其他服务；docker/.env 不改                                   |
| peer 会话冲突          | 动手前 fetch 服务器 main；merge 遇 husky 拦截用 `--no-verify`（历史先例）          |
| e2e 选择器             | Phase 2 已同步修复，本地先跑绿再部署                                               |
| 缓存投毒复发           | 不新增 queryKey，不改现有返回结构；新组件只消费现有 hooks                          |
| 免费模式开关           | 构建参数 NEXT_PUBLIC_PAYMENT_MODE=off 不变；pill 显示逻辑内嵌 FREE_MODE 分支       |
| 构建缓存诡异           | build --no-cache（既有惯例）                                                       |

### 回滚预案（两级）

- **快速回滚（分钟级）**：服务器 `git revert <本次两个 commit>` → 重 build → up。适合样式/交互级问题。
- **镜像回滚（应急）**：部署前记录当前 app 镜像 digest（`docker images --digests | grep campus`）；异常时 `docker tag <旧digest对应镜像> <当前tag>` 后 up。适合构建失败以外的一切页面级故障。
- 回滚不影响数据（纯前端，无迁移无数据变更）。

## 6. 验收清单

### 本地（Phase 3）

- [ ] 主页：刊头统计数字非零；分类行 chips 全部可点进 explore
- [ ] 新生特辑：chips 只显示有作品的标签；3 条序号行 hover 正常；flag off 时整块消失
- [ ] 最新上架：hero 为 sort=new 第一条；「加载更早」翻页有效；日期列取 publishedAt
- [ ] 编辑推荐/路线图/排行榜 tab/公告/分类计数 全部有数据
- [ ] 关注动态（登录态）出现在分类行下方
- [ ] explore：列表渲染、筛选（标签/课程/价格/排序）与分页全通
- [ ] 375px 视口全页无横向滚动、无元素溢出
- [ ] typecheck / lint / build / e2e 全绿

### 线上（Phase 4 部署后）

- [ ] kedahub.cn 主页/explore 桌面+手机视口正常
- [ ] 登录（smoke 账号）与未登录两态渲染正常
- [ ] 管理员后台 /ops 不受影响（未改动，抽查即可）
- [ ] work 详情页、search、用户主页（旧卡片，未改）正常
- [ ] Docker 日志无 hydration error / 500
- [ ] 30 分钟后复查 app 容器 CPU 与错误日志（真实用户已存在，留意新增报错）

## 7. 二期候选（本文档不实施）

- search / 用户主页作品 tab / roadmap 详情内嵌 → FeedRow compact
- 旧卡片组件与样式删除（WorkCard/FineCard/card-grid 等）
- masthead 「本周新增」统计（需后端加 publishedAt 范围参数）
- hero 支持运营置顶（P1 推荐池 pinned 字段，见 ADMIN_CONTENT_MGMT.md）
