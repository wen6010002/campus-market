# 管理员资料管理界面 — 设计方案（待实现）

> 2026-09-05 · 起因：真实资料上线（135 作品 + 8 路线图）后，调整资料位置/分类/展示位只能进数据库或写脚本，运营效率跟不上。本文是 /admin 资料管理模块的完整设计，实现排期由用户决定。

## 一、现状与痛点

- 分类调整：改 `works.category` 只能 SQL（本次导入中 ABROAD 曾靠部署后重跑解决）
- 展示位调整：精品位 = `isFree=false`，改库才能把一份资料推上首页精品区
- 首页「今日免费推荐」固定按热度排序，无人工置顶/排位手段（开学季想把「开学准备清单」钉在第一位做不到）
- MinIO 孤儿文件：重复导入留下 154 个无 DB 引用的对象，无界面发现与清理
- 路线图关联资料（RoadmapWorkLink）建好后不可改

## 二、功能设计

### 1. 作品管理（核心，P0）

入口：/admin 新增「资料管理」tab。列表页结构复用 ops 订单表风格：

- 筛选栏：分类（含 ABROAD 七类）/ 状态（PUBLISHED、PENDING、TAKEN_DOWN、DRAFT）/ 展示位（普通、精品）/ 标题关键词
- 列：封面图标、标题、分类、展示位、状态、下载/收藏计数、上传者、操作
- 行内操作（抽屉或弹窗编辑表单）：
  - 改分类（下拉七类，保存即清 works:list 缓存）
  - 切换精品展示位（isFree 开关；开时提示「V7 免费模式下仅影响首页精品区展示，下载仍免费」）
  - 改标题/描述/标签/封面图标/封面主题
  - 上架/下架（TAKEN_DOWN ↔ PUBLISHED）、删除（软删 deletedAt）
- 批量操作：多选 → 批量改分类 / 批量下架 / 批量设精品

### 2. 推荐位与排序（P1）

首页「今日免费推荐」8 张卡目前纯热度。增量两字段：

- `works.pinned Boolean @default(false)` — 是否进推荐池
- `works.sortNo Int @default(0)` — 池内人工序（小在前；同序按下载数）

admin 界面提供「推荐池」子页：拖拽排序（或 ↑↓ 按钮），从推荐池移除。list() 查询改为 `pinned 优先按 sortNo，补足 8 张按热度`。新生区横幅 chips 命中 CAMPUS 后的排序同理可挂 pinned。

### 3. 路线图管理（P1）

- 列表 + 上下架 + 改分类/图标/摘要
- 关联资料编辑：RoadmapWorkLink 的增删排序（路线详情页「配套资料」区块数据源）
- md 源重新上传：替换 mdSourceKey 并重新解析（注意：content steps 的 id 变化会作废已有打卡记录，界面需二次确认「重传将清空 N 位同学的打卡进度」）

### 4. 存储治理（P2）

- GET /admin/storage/orphans：列 MinIO works/ 下不在任何 works.fileKey 的对象（大小+时间）
- 一键清理（mc 删除）；预计本次能回收 ~20MB/154 对象
- 触发时机：手动按钮即可，不自动跑

## 三、API 增量（契约 §12）

| 方法   | 路径                                                  | 说明                                                                      |
| ------ | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| GET    | /admin/works?category=&status=&fine=&q=&page=         | 管理列表（含未发布）                                                      |
| PATCH  | /admin/works/:id                                      | 元数据编辑（category/isFree/title/description/tags/coverIcon/coverTheme） |
| PATCH  | /admin/works/:id/status                               | 上下架（PUBLISHED ↔ TAKEN_DOWN）                                          |
| DELETE | /admin/works/:id                                      | 软删                                                                      |
| POST   | /admin/works/batch                                    | { ids, action: recat/fine/takeDown, payload }                             |
| PATCH  | /admin/works/:id/pin                                  | { pinned, sortNo }                                                        |
| GET    | /admin/roadmaps、PATCH /admin/roadmaps/:id            | 同作品                                                                    |
| PUT    | /admin/roadmaps/:id/links                             | 替换关联作品集合                                                          |
| GET    | /admin/storage/orphans、DELETE /admin/storage/orphans | 孤儿清理                                                                  |

全部 requireAdmin；写操作走 audit_logs 留痕（表已有）；改元数据后 cacheDelByPattern('works:list:*')。

## 四、数据模型增量（一个迁移）

works 加 pinned/sortNo 两列即可，其余复用现有字段（isFree 当展示位、quality 备用）。无破坏性变更。

## 五、UI 骨架

/admin 资料管理 tab，上下两段：

- 顶段：筛选栏 + 批量操作条（选中 N 项时浮现）
- 主体：作品表格（行点击开右侧抽屉编辑；状态徽章复用 ops 的样式语言）
- 推荐池入口：表格上方 tab 切换「全部作品 / 推荐池」

风格沿用 ops 现有表格（紧凑、斑马纹、状态 pill），不新建设计语言。

## 六、实现顺序建议

1. P0 作品列表 + 单条编辑（改分类/精品/上下架）—— 解决 90% 日常运营
2. P1 推荐位排序（迁移 + list() 改造 + 推荐池子页）
3. P1 路线图管理与关联编辑
4. P2 存储治理

P0 预估一个工作日内（列表接口已有 admin/works 可扩展，编辑接口全部薄封装 service）。
