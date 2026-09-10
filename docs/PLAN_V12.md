# V12 计划与实施记录：评论区 + AI 审核 + 站内打卡 + 连续打卡榜

> 2026-09-10。四个特性一次交付：资料/路线图双区评论区（先发后审·异步 AI）、
> 敏感词分级拦截（借开源词库）、打卡站内统计（DailyCheckin 账本）、连续打卡榜（前 30+宿舍楼巧思）。

## 决策记录（与站主两轮讨论定稿）

| 决策点   | 定稿                                            | 备注                                |
| -------- | ----------------------------------------------- | ----------------------------------- |
| 评论定位 | 独立于评价区，双区都做                          | 评价=下载后星级信任体系，不动       |
| 评论门槛 | 所有登录用户                                    | 预览即可评，不再要求下载过          |
| 回复结构 | 两级（评论+回复）                               | parentId 深度/状态双守卫            |
| 审核模式 | **先发后审·异步 AI**                            | 三道同步硬闸补偿风险（见下）        |
| AI       | DeepSeek deepseek-chat                          | ≈¥0.001/次，双端直连                |
| 违规处理 | 隐藏+通知；7 天拒≥3 进重点观察，人工封          | 人在环，不自动封                    |
| 宿舍楼   | 预设下拉可隐藏                                  | 2023 社区制真实楼名，只到楼不到房间 |
| 榜单位置 | 榜页 /roadmaps/rank + 列表入口卡 + 首页第 5 tab | 前 30 + 我的卡                      |
| 打卡规则 | 勾任意路线任意步骤=当日打卡；断一天清零无补签   | 修掉「取消勾选追溯抹记录」旧缺陷    |

**先发后审的三道同步硬闸**（无备案平台的举报风险补偿）：

1. 黑名单词同步毫秒级拦截（REJECT 硬拒入库留痕 + 400；REVIEW 广告类转人工）
2. 含 URL 评论一律 PENDING_REVIEW 不公开（钓鱼/导流是最高举报风险），AI approve 才可见
3. AI 故障重试耗尽/队列失败 → fail-closed 转人工（绝不无审核放行）

词库：fwwdn/sensitive-stop-words（Apache-2.0）四分类 1169 词 + 自建校园专项
（代考代写 REJECT / 刷单兼职 REVIEW）+ 哨兵词「课搭测试违禁词」供冒烟。
构建脚本 `pnpm build:words` 把 dict txt 编译成 TS 常量（standalone 镜像无 fs 依赖）。

## 关键实现

- **迁移** `20260910160000_v12_comments_checkins_dorm`（纯增量）：CommentStatus 枚举 +
  comments 加 status/modReason/modSource/reviewedAt/roadmapId（workId 转 nullable）；
  daily_checkins 表（userId+day 唯一，streakDays 索引）；users.dorm；NotificationType +3。
  ⚠️ migrate diff 会想 DROP v4 手写 trgm 索引（schema 声明不了 GIN）——手工剔除，历史约定保留。
- **管线** comment.service.create：限流 6/10min → 黑名单分级 → URL 暂审 → 重复内容 409 →
  入库 → enqueue comment-moderate（3 次指数退避）→ 通知（WORK_COMMENTED/COMMENT_REPLIED）。
- **worker**：scheduler 复用共享 queue.ts 单例，新增 comment-moderate case +
  failed 钩子 fail-close。moderateComment 幂等（approve/reject/review/缺 key 四分支）。
- **打卡**：toggleCheck 同事务 upsert DailyCheckin（streak=昨日+1 或归 1）；
  progress() 的 byDay/streak 切站内口径（前端侧栏零结构改动）；
  回填脚本 scripts/backfill-daily-checkins.ts（部署顺序：migrate → 回填 → 重建容器）。
- **榜**：rank.service checkin 分支取今日/昨日行（活跃 streak），同分早达成优先，
  缓存 rank:checkin 300s（invalidateAuthorCaches 清 rank:* 白捡失效）。
- **管理端**：/admin 新 tab 评论审核（待审/已拒双队列 + 重点观察条），处置带 ADMIN 留痕。
- env 自检新增 DEEPSEEK_API_KEY（生产缺 key 直接拦启动——部署时必须先写 .env 再重建容器）。

## 测试与验收（全部通过）

- 单测 8 例（词匹配变体对抗/分级/零误伤/dayCn8）+ 集成 22 例（管线 9 + 审核 7 + 打卡榜 6）
- 全量 **219/219**（原 188 + 新 31）；typecheck/lint 绿；build 绿
- e2e：comments.spec 4/4（发布即显→回复→删除、路线图评论、违禁词秒拒、榜页）+
  回归 paths.spec **11/11**
- 冒烟脚本新增 7 项检查（评论正负路径/统计/榜单/页面）

## 部署顺序（红线：线上数据零影响）

1. 服务器手动 pg_dump 快照（v12-pre）
2. **.env 写入 DEEPSEEK_API_KEY（容器重建前）**
3. push → bundle → merge → `pnpm prisma:migrate:deploy` →
   宿主机 `pnpm tsx scripts/backfill-daily-checkins.ts` → up -d --build app worker
4. 冒烟（35+7 项）+ 存量表计数逐项对比 + 新表行数合理
5. 回滚：git revert + rebuild（additive 迁移对旧代码无害）；最后手段用 v12-pre 快照

## 待办 / 已知取舍

- [ ] 丽湖校区楼栋名待站主校对（DORM_OPTIONS 一处数组）
- [ ] 评论点赞（Comment.likes 字段已备）backlog
- [ ] 用户名/作品标题黑名单（本期只覆盖评论+评价文字）backlog
- [ ] 词表后续增删：改 dict/*.txt → pnpm build:words → 提交
