/**
 * 评论服务（V2-5 建，V12 全面扩展）。
 *
 * 创建管线（先发后审·异步 AI + 三道同步硬闸）：
 * 1. 限流 rl:comment:{userId} 6/10min（评论+回复共享）
 * 2. 黑名单词（words.ts 同步毫秒级）：REJECT 硬类别 → 入库 REJECTED 留痕 + 400；
 *    REVIEW 广告类 → 入库 PENDING_REVIEW 转人工
 * 3. 含 URL → PENDING_REVIEW（不公开，AI approve 才可见——钓鱼/导流是最高举报风险）
 * 4. 正常 → VISIBLE 即显 + enqueue comment-moderate（worker 调 DeepSeek 复审，
 *    reject 翻 REJECTED 隐藏；故障重试耗尽 fail-closed 转人工，绝不无审核放行）
 *
 * 目标二选一：WORK（资料详情）/ ROADMAP（路线图详情），workId/roadmapId 互斥由本层校验。
 */
import { createHash } from 'node:crypto';
import { prisma } from '../db';
import { redis } from '../lib/redis';
import { appError } from '../lib/errors';
import { sanitize } from '../lib/sanitize';
import { enforceRateLimit } from '../lib/ratelimit';
import { logger } from '../lib/logger';
import { notifyService } from './notify.service';
import { achievementService } from './achievement.service';
import { checkBlocked, containsUrl } from '../moderation/words';
import { CATEGORY_LABEL, reviewText, ModerationDisabledError } from '../moderation/ai';
import { enqueue } from '../jobs/queue';
import { NotificationType } from '@/lib/constants';

export type CommentTarget = 'WORK' | 'ROADMAP';

/** 入队配置：3 次指数退避（5s/10s/20s），耗尽由 scheduler failed 钩子 fail-close */
const MODERATE_JOB_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5_000 },
};

const USER_SELECT = {
  id: true,
  username: true,
  avatarColor: true,
  avatarKey: true,
  updatedAt: true,
} as const;

function toUser(u: {
  id: string;
  username: string;
  avatarColor: string;
  avatarKey: string | null;
  updatedAt: Date;
}) {
  return {
    id: u.id,
    username: u.username,
    avatarColor: u.avatarColor,
    hasAvatar: !!u.avatarKey,
    avatarVer: u.updatedAt.getTime(),
  };
}

interface Target {
  where: { workId: string } | { roadmapId: string };
  ownerId: string;
  title: string;
  link: string;
  label: string; // 通知文案用：「作品」/「路线图」
}

async function resolveTarget(type: CommentTarget, id: string): Promise<Target> {
  if (type === 'WORK') {
    const w = await prisma.work.findFirst({
      where: { id, deletedAt: null, status: 'PUBLISHED' },
    });
    if (!w) throw appError('NOT_FOUND', '作品不存在');
    return {
      where: { workId: id },
      ownerId: w.authorId,
      title: w.title,
      link: `/work/${id}`,
      label: '作品',
    };
  }
  const r = await prisma.roadmap.findFirst({
    where: { id, deletedAt: null, status: 'PUBLISHED' },
  });
  if (!r) throw appError('NOT_FOUND', '路线图不存在');
  return {
    where: { roadmapId: id },
    ownerId: r.uploaderId,
    title: r.title,
    link: `/roadmaps/${id}`,
    label: '路线图',
  };
}

/** 发评论 */
async function create(
  userId: string,
  targetType: CommentTarget,
  targetId: string,
  content: string,
  parentId?: string,
) {
  await enforceRateLimit(`rl:comment:${userId}`, 6, 10 * 60_000);

  const target = await resolveTarget(targetType, targetId);

  // 回复守卫：父评必须存在、同目标、是一级评论、且已过审可见（深度+状态双守卫）
  let parent: { id: string; userId: string } | null = null;
  if (parentId) {
    const p = await prisma.comment.findFirst({
      where: {
        id: parentId,
        deletedAt: null,
        status: 'VISIBLE',
        parentId: null,
        ...target.where,
      },
      select: { id: true, userId: true },
    });
    if (!p) throw appError('NOT_FOUND', '要回复的评论不存在或暂不可回复');
    parent = p;
  }

  // 同步闸 1：黑名单（毫秒级）
  const wordHit = checkBlocked(content);
  // 同步闸 2：URL
  const urlHit = containsUrl(content);

  let status: 'VISIBLE' | 'PENDING_REVIEW' | 'REJECTED' = 'VISIBLE';
  let modSource: string | null = null;
  let modReason: string | null = null;
  if (wordHit && wordHit.action === 'REJECT') {
    status = 'REJECTED';
    modSource = 'KEYWORD';
    modReason = `${CATEGORY_LABEL[wordHit.category] ?? wordHit.category}：命中「${wordHit.word}」`;
  } else if (wordHit) {
    status = 'PENDING_REVIEW';
    modSource = 'KEYWORD';
    modReason = `疑似广告：命中「${wordHit.word}」`;
  } else if (urlHit) {
    status = 'PENDING_REVIEW';
    modSource = 'URL_HOLD';
    modReason = '包含链接，待审核';
  }

  if (status !== 'REJECTED') {
    // 灌水守卫：10 分钟内同内容重复（REJECT 的不入此检查，直接留痕拒绝）
    const dupKey = `cdup:${userId}:${createHash('sha1').update(content).digest('hex').slice(0, 16)}`;
    const first = await redis.set(dupKey, '1', 'EX', 600, 'NX');
    if (first !== 'OK') throw appError('CONFLICT', '相同内容刚发过，请稍后再试或换个说法');
  }

  const comment = await prisma.comment.create({
    data: {
      userId,
      content: sanitize(content),
      parentId: parent?.id ?? null,
      status,
      modSource,
      modReason,
      ...target.where,
    },
  });

  if (status === 'REJECTED') {
    await notifyService.createNotification(
      userId,
      NotificationType.COMMENT_REJECTED,
      `你的评论未通过审核：${modReason ?? '包含违规内容'}`,
      null,
    );
    throw appError('COMMENT_REJECTED', '评论包含违规内容，请修改后重发');
  }

  // 入队 AI 复审（含 PENDING：AI approve 可直接放行）；入队失败 → fail-closed 转人工
  try {
    await enqueue('comment-moderate', { commentId: comment.id }, MODERATE_JOB_OPTS);
  } catch (e) {
    logger.error({ err: e, commentId: comment.id }, '评论审核任务入队失败，转人工');
    await prisma.comment.update({
      where: { id: comment.id },
      data: { status: 'PENDING_REVIEW', modSource: 'QUEUE_FAIL' },
    });
    return { id: comment.id, status: 'PENDING_REVIEW' as const };
  }

  if (status === 'VISIBLE') {
    await notifyVisible(comment.id, target, parent?.userId ?? null, comment.userId);
  }
  return { id: comment.id, status };
}

/** 评论可见后发通知：目标 owner（WORK_COMMENTED）+ 被回复人（COMMENT_REPLIED）；自己互动自己不发 */
async function notifyVisible(
  commentId: string,
  target: Target,
  parentAuthorId: string | null,
  authorId: string,
) {
  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { username: true },
  });
  if (!author) return;
  const link = `${target.link}?c=${commentId}#comments`;
  if (target.ownerId !== authorId) {
    await notifyService.createNotification(
      target.ownerId,
      NotificationType.WORK_COMMENTED,
      `${author.username} 评论了你的${target.label}《${target.title.slice(0, 30)}》`,
      link,
    );
  }
  if (parentAuthorId && parentAuthorId !== authorId && parentAuthorId !== target.ownerId) {
    await notifyService.createNotification(
      parentAuthorId,
      NotificationType.COMMENT_REPLIED,
      `${author.username} 回复了你的评论`,
      link,
    );
  }
}

/** AI 复审（worker：comment-moderate 任务）。幂等：REJECTED/已删直接跳过 */
async function moderateComment(commentId: string) {
  const c = await prisma.comment.findFirst({
    where: { id: commentId, deletedAt: null },
    include: {
      user: { select: { id: true, username: true } },
      work: { select: { id: true, title: true, authorId: true } },
      roadmap: { select: { id: true, title: true, uploaderId: true } },
    },
  });
  if (!c || c.status === 'REJECTED') return { ok: true, skipped: true };

  let verdict: Awaited<ReturnType<typeof reviewText>>;
  try {
    verdict = await reviewText(c.content);
  } catch (e) {
    if (e instanceof ModerationDisabledError) {
      // 缺 key 是确定性故障，重试无意义：直接 fail-closed
      await failCloseComment(commentId);
      return { ok: true, disabled: true };
    }
    throw e; // 网络类错误交给任务重试
  }

  const target: Target | null = c.work
    ? {
        where: { workId: c.work.id },
        ownerId: c.work.authorId,
        title: c.work.title,
        link: `/work/${c.work.id}`,
        label: '作品',
      }
    : c.roadmap
      ? {
          where: { roadmapId: c.roadmap.id },
          ownerId: c.roadmap.uploaderId,
          title: c.roadmap.title,
          link: `/roadmaps/${c.roadmap.id}`,
          label: '路线图',
        }
      : null;

  const parentAuthorId = c.parentId
    ? ((await prisma.comment.findUnique({ where: { id: c.parentId }, select: { userId: true } }))
        ?.userId ?? null)
    : null;

  if (verdict.verdict === 'approve') {
    const wasPending = c.status === 'PENDING_REVIEW';
    await prisma.comment.update({
      where: { id: commentId },
      data: { status: 'VISIBLE', modSource: 'AI', reviewedAt: new Date() },
    });
    if (wasPending && target) {
      // 链接/广告暂审的评论此时才对 owner 可见 → 补发通知
      await notifyVisible(commentId, target, parentAuthorId, c.userId);
    }
    return { ok: true, verdict: 'approve' };
  }

  if (verdict.verdict === 'reject') {
    const label = verdict.category
      ? (CATEGORY_LABEL[verdict.category] ?? verdict.category)
      : '违规内容';
    await prisma.comment.update({
      where: { id: commentId },
      data: {
        status: 'REJECTED',
        modSource: 'AI',
        modReason: `AI 判定${label}${verdict.reason ? `：${verdict.reason}` : ''}`.slice(0, 200),
        reviewedAt: new Date(),
      },
    });
    await notifyService.createNotification(
      c.userId,
      NotificationType.COMMENT_REJECTED,
      `你的评论未通过审核：${label}`,
      null,
    );
    return { ok: true, verdict: 'reject' };
  }

  // review（不确定）→ 转人工
  await prisma.comment.update({
    where: { id: commentId },
    data: {
      status: 'PENDING_REVIEW',
      modSource: 'AI',
      modReason: `AI 不确定${verdict.reason ? `：${verdict.reason}` : ''}`.slice(0, 200),
      reviewedAt: new Date(),
    },
  });
  return { ok: true, verdict: 'review' };
}

/** fail-closed：审核链路故障时评论转人工待审（不公开），由管理员处置 */
async function failCloseComment(commentId: string) {
  await prisma.comment.updateMany({
    where: { id: commentId, status: { not: 'REJECTED' }, deletedAt: null },
    data: { status: 'PENDING_REVIEW', modSource: 'AI_FAIL', reviewedAt: new Date() },
  });
}

export const commentService = {
  create,
  moderateComment,
  failCloseComment,

  /** 评论列表（公开；匿名只见 VISIBLE，本人另见自己的待审行） */
  async list(
    targetType: CommentTarget,
    targetId: string,
    page: number,
    pageSize: number,
    viewerId?: string,
  ) {
    const targetWhere = targetType === 'WORK' ? { workId: targetId } : { roadmapId: targetId };
    // 公开计数只算 VISIBLE（自己的待审行不算楼数）
    const [total, rows] = await Promise.all([
      prisma.comment.count({
        where: { ...targetWhere, deletedAt: null, status: 'VISIBLE', parentId: null },
      }),
      prisma.comment.findMany({
        where: {
          ...targetWhere,
          deletedAt: null,
          parentId: null,
          OR: [
            { status: 'VISIBLE' },
            ...(viewerId ? [{ status: 'PENDING_REVIEW' as const, userId: viewerId }] : []),
          ],
        },
        include: { user: { select: USER_SELECT } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // 回归楼：本页一级评论的回复（时间正序）
    const ids = rows.map((r) => r.id);
    const replies = ids.length
      ? await prisma.comment.findMany({
          where: {
            parentId: { in: ids },
            deletedAt: null,
            OR: [
              { status: 'VISIBLE' },
              ...(viewerId ? [{ status: 'PENDING_REVIEW' as const, userId: viewerId }] : []),
            ],
          },
          include: { user: { select: USER_SELECT } },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const allUsers = [...rows, ...replies];
    const badges = await achievementService.inlineBadges(allUsers.map((r) => r.userId));

    const shape = (c: (typeof rows)[number]) => ({
      id: c.id,
      content: c.content,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      user: { ...toUser(c.user), badge: badges[c.userId] ?? null },
      parentId: c.parentId,
      _mine: c.userId === viewerId,
    });

    const byParent = new Map<string, typeof replies>();
    for (const r of replies) {
      const key = r.parentId as string;
      const arr = byParent.get(key) ?? [];
      arr.push(r);
      byParent.set(key, arr);
    }

    return {
      data: rows.map((r) => ({
        ...shape(r),
        replies: (byParent.get(r.id) ?? []).map(shape),
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  },

  /** 删评论（owner/admin，软删） */
  async remove(commentId: string, userId: string, isAdmin: boolean) {
    const comment = await prisma.comment.findFirst({ where: { id: commentId, deletedAt: null } });
    if (!comment) throw appError('NOT_FOUND', '评论不存在');
    if (!isAdmin && comment.userId !== userId) throw appError('FORBIDDEN', '无权删除他人评论');
    await prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
    return { ok: true };
  },

  // ---- 管理端（V12 审核队列）----

  /** 待审/已拒队列 + 重点观察（7 天被拒 ≥3 的用户） */
  async adminList(status: 'PENDING_REVIEW' | 'REJECTED', page: number, pageSize: number) {
    const where = { status, deletedAt: null };
    const [total, rows] = await Promise.all([
      prisma.comment.count({ where }),
      prisma.comment.findMany({
        where,
        include: {
          user: { select: USER_SELECT },
          work: { select: { id: true, title: true } },
          roadmap: { select: { id: true, title: true } },
        },
        // 待审队列：最早的先处理；已拒日志：最新在前
        orderBy: status === 'PENDING_REVIEW' ? { createdAt: 'asc' } : { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // 重点观察：7 天内被拒 ≥3 次
    const since = new Date(Date.now() - 7 * 86400_000);
    const rejected = await prisma.comment.findMany({
      where: { status: 'REJECTED', updatedAt: { gte: since } },
      select: { userId: true },
    });
    const counts = new Map<string, number>();
    for (const r of rejected) counts.set(r.userId, (counts.get(r.userId) ?? 0) + 1);
    const watchIds = [...counts.entries()]
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    const watchUsers = watchIds.length
      ? await prisma.user.findMany({
          where: { id: { in: watchIds.map(([id]) => id) } },
          select: { id: true, username: true, status: true, email: true },
        })
      : [];

    return {
      data: rows.map((c) => ({
        id: c.id,
        content: c.content,
        status: c.status,
        modReason: c.modReason,
        modSource: c.modSource,
        createdAt: c.createdAt.toISOString(),
        reviewedAt: c.reviewedAt?.toISOString() ?? null,
        user: toUser(c.user),
        target: c.work
          ? { type: 'WORK' as const, id: c.work.id, title: c.work.title }
          : c.roadmap
            ? { type: 'ROADMAP' as const, id: c.roadmap.id, title: c.roadmap.title }
            : null,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      watchlist: watchUsers.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        status: u.status,
        rejected7d: counts.get(u.id) ?? 0,
      })),
    };
  },

  /** 管理员处置：APPROVE 放行 / REJECT 拒绝（均通知作者，留 ADMIN 痕） */
  async adminHandle(commentId: string, action: 'APPROVE' | 'REJECT', _adminId: string) {
    const c = await prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
      include: {
        work: { select: { id: true, title: true, authorId: true } },
        roadmap: { select: { id: true, title: true, uploaderId: true } },
      },
    });
    if (!c) throw appError('NOT_FOUND', '评论不存在');

    if (action === 'APPROVE') {
      const wasVisible = c.status === 'VISIBLE';
      await prisma.comment.update({
        where: { id: commentId },
        data: { status: 'VISIBLE', modSource: 'ADMIN', reviewedAt: new Date() },
      });
      await notifyService.createNotification(
        c.userId,
        NotificationType.SYSTEM,
        '你的评论已通过审核',
        null,
      );
      if (!wasVisible && (c.work || c.roadmap)) {
        const target: Target = c.work
          ? {
              where: { workId: c.work.id },
              ownerId: c.work.authorId,
              title: c.work.title,
              link: `/work/${c.work.id}`,
              label: '作品',
            }
          : {
              where: { roadmapId: c.roadmap!.id },
              ownerId: c.roadmap!.uploaderId,
              title: c.roadmap!.title,
              link: `/roadmaps/${c.roadmap!.id}`,
              label: '路线图',
            };
        const parentAuthorId = c.parentId
          ? ((
              await prisma.comment.findUnique({
                where: { id: c.parentId },
                select: { userId: true },
              })
            )?.userId ?? null)
          : null;
        await notifyVisible(commentId, target, parentAuthorId, c.userId);
      }
      return { ok: true, status: 'VISIBLE' as const };
    }

    await prisma.comment.update({
      where: { id: commentId },
      data: {
        status: 'REJECTED',
        modSource: 'ADMIN',
        modReason: '管理员判定不适宜展示',
        reviewedAt: new Date(),
      },
    });
    await notifyService.createNotification(
      c.userId,
      NotificationType.COMMENT_REJECTED,
      '你的评论未通过审核：管理员判定不适宜展示',
      null,
    );
    return { ok: true, status: 'REJECTED' as const };
  },
};
