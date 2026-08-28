import { prisma } from '../db';
import { appError } from '../lib/errors';
import { sanitize } from '../lib/sanitize';
import { enforceRateLimit } from '../lib/ratelimit';
import { notifyService } from './notify.service';
import type { ReportTargetType, ReportReason, ReportStatus } from '@/lib/constants';

/** 举报目标快照（创建时生成，处置时内容可能已删改） */
async function buildSnapshot(targetType: ReportTargetType, targetId: string) {
  if (targetType === 'WORK') {
    const w = await prisma.work.findFirst({
      where: { id: targetId, deletedAt: null },
      include: { author: { select: { id: true, username: true } } },
    });
    if (!w) throw appError('NOT_FOUND', '被举报的作品不存在');
    return {
      targetTitle: w.title.slice(0, 200),
      targetAuthorId: w.authorId,
      targetSnapshot: {
        title: w.title,
        desc: w.description.slice(0, 200),
        workStatus: w.status,
        authorName: w.author.username,
      },
    };
  }
  if (targetType === 'COMMENT') {
    const c = await prisma.comment.findFirst({
      where: { id: targetId, deletedAt: null },
      include: {
        work: { select: { id: true, title: true } },
        user: { select: { id: true, username: true } },
      },
    });
    if (!c) throw appError('NOT_FOUND', '被举报的评论不存在');
    return {
      targetTitle: `${c.user.username} 的评论：${c.content.slice(0, 30)}`,
      targetAuthorId: c.userId,
      targetSnapshot: { content: c.content, workTitle: c.work.title, authorName: c.user.username },
    };
  }
  if (targetType === 'RATING') {
    const r = await prisma.workRating.findUnique({
      where: { id: targetId },
      include: {
        work: { select: { id: true, title: true } },
        user: { select: { id: true, username: true } },
      },
    });
    if (!r) throw appError('NOT_FOUND', '被举报的评价不存在');
    return {
      targetTitle: `${r.user.username} 的评价（${r.stars}星）：${r.text.slice(0, 30)}`,
      targetAuthorId: r.userId,
      targetSnapshot: {
        content: r.text,
        stars: r.stars,
        workTitle: r.work.title,
        authorName: r.user.username,
      },
    };
  }
  // USER
  const u = await prisma.user.findFirst({
    where: { id: targetId, deletedAt: null },
    select: { id: true, username: true, bio: true },
  });
  if (!u) throw appError('NOT_FOUND', '被举报的用户不存在');
  return {
    targetTitle: u.username,
    targetAuthorId: u.id,
    targetSnapshot: { username: u.username, bio: u.bio },
  };
}

const REPORT_STATUS_LABEL: Record<string, string> = {
  OPEN: '待处理',
  PROCESSING: '处理中',
  RESOLVED: '已处置',
  DISMISSED: '已驳回',
};

export const reportService = {
  REPORT_STATUS_LABEL,

  /** 举报（登录，5/小时限流 + 同人同目标未结单幂等 + 内容快照） */
  async create(
    reporterId: string,
    input: {
      targetType: ReportTargetType;
      targetId: string;
      reason: ReportReason;
      detail?: string;
    },
  ) {
    await enforceRateLimit(`rl:report:${reporterId}`, 5, 3600_000);
    const dup = await prisma.report.findFirst({
      where: {
        reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        status: { in: ['OPEN', 'PROCESSING'] },
      },
    });
    if (dup) throw appError('CONFLICT', '你已举报过该内容，请等待处理');

    const snap = await buildSnapshot(input.targetType, input.targetId);
    const report = await prisma.report.create({
      data: {
        reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        detail: input.detail ? sanitize(input.detail) : null,
        status: 'OPEN',
        ...snap,
      },
    });
    return {
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      detail: report.detail,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
    };
  },

  /** 我的举报（V3-6） */
  async myReports(userId: string) {
    const reports = await prisma.report.findMany({
      where: { reporterId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return reports.map((r) => ({
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      targetTitle: r.targetTitle,
      reason: r.reason,
      detail: r.detail,
      status: r.status,
      statusLabel: REPORT_STATUS_LABEL[r.status],
      handleNote: r.handleNote,
      createdAt: r.createdAt.toISOString(),
      handledAt: r.handledAt?.toISOString() ?? null,
    }));
  },

  /** 举报队列（ADMIN，按 target 聚合：人数 / 举报人明细 / 原因分布 / 快照） */
  async adminList(statusFilter?: string) {
    const where: any = {};
    if (statusFilter === 'OPEN') where.status = 'OPEN';
    if (statusFilter === 'RESOLVED') where.status = 'RESOLVED';
    if (statusFilter === 'DISMISSED') where.status = 'DISMISSED';
    const reports = await prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { reporter: { select: { username: true } } },
      take: 500,
    });

    const groups = new Map<
      string,
      {
        targetType: string;
        targetId: string;
        targetTitle: string | null;
        snapshot: any;
        targetAuthorId: string | null;
        rows: typeof reports;
      }
    >();
    for (const r of reports) {
      const key = `${r.targetType}:${r.targetId}`;
      if (!groups.has(key)) {
        groups.set(key, {
          targetType: r.targetType,
          targetId: r.targetId,
          targetTitle: r.targetTitle,
          snapshot: r.targetSnapshot as any,
          targetAuthorId: r.targetAuthorId,
          rows: [],
        });
      }
      groups.get(key)!.rows.push(r);
    }

    const data = [...groups.values()].map((g) => {
      const reasons = new Map<string, number>();
      for (const r of g.rows) reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1);
      const openCount = g.rows.filter(
        (r) => r.status === 'OPEN' || r.status === 'PROCESSING',
      ).length;
      return {
        targetType: g.targetType,
        targetId: g.targetId,
        targetTitle: g.targetTitle,
        snapshot: g.snapshot,
        targetAuthorId: g.targetAuthorId,
        count: g.rows.length,
        reporters: g.rows.map((r) => ({
          username: r.reporter.username,
          reason: r.reason,
          detail: r.detail,
          at: r.createdAt.toISOString(),
        })),
        reasons: [...reasons.entries()].map(([reason, n]) => ({ reason, n })),
        latestAt: g.rows[0].createdAt.toISOString(),
        openCount,
        status: openCount > 0 ? 'OPEN' : g.rows[0].status,
      };
    });
    return { data, total: data.length };
  },

  /** 处置（ADMIN，按 target 批量关单 + 措施联动 + 双向通知；不做侵权退款——产品决策 V3） */
  async adminHandle(
    input: {
      targetType: ReportTargetType;
      targetId: string;
      action: 'RESOLVE' | 'DISMISS';
      note?: string;
      measures?: {
        takedownWork?: boolean;
        deleteComment?: boolean;
        banUser?: boolean;
        banReason?: string;
      };
    },
    adminId: string,
  ) {
    if (input.action === 'DISMISS' && !input.note) {
      throw appError('VALIDATION', '驳回需填写说明');
    }
    const snap = await buildSnapshot(input.targetType, input.targetId).catch(() => null);
    const open = await prisma.report.findMany({
      where: {
        targetType: input.targetType,
        targetId: input.targetId,
        status: { in: ['OPEN', 'PROCESSING'] },
      },
    });
    if (!open.length) throw appError('NOT_FOUND', '该内容下没有待处理的举报');

    const status: ReportStatus = input.action === 'RESOLVE' ? 'RESOLVED' : 'DISMISSED';
    const measures = input.measures ?? {};
    const measureNotes: string[] = [];

    await prisma.$transaction(async (tx) => {
      await tx.report.updateMany({
        where: { id: { in: open.map((r) => r.id) } },
        data: { status, handlerId: adminId, handleNote: input.note ?? null, handledAt: new Date() },
      });

      if (input.action === 'RESOLVE') {
        if (measures.takedownWork && input.targetType === 'WORK') {
          await tx.work.update({
            where: { id: input.targetId },
            data: { status: 'TAKEN_DOWN' },
          });
          await tx.auditLog.create({
            data: {
              workId: input.targetId,
              action: 'TAKE_DOWN',
              reviewerId: adminId,
              note: `举报处置：${input.note ?? ''}`,
            },
          });
          measureNotes.push('作品已下架');
        }
        if (
          measures.deleteComment &&
          (input.targetType === 'COMMENT' || input.targetType === 'RATING')
        ) {
          if (input.targetType === 'COMMENT') {
            await tx.comment.update({
              where: { id: input.targetId },
              data: { deletedAt: new Date() },
            });
          } else {
            await tx.workRating.delete({ where: { id: input.targetId } });
          }
          measureNotes.push(input.targetType === 'COMMENT' ? '评论已删除' : '评价已删除');
        }
        if (measures.banUser && snap?.targetAuthorId) {
          await tx.user.update({
            where: { id: snap.targetAuthorId },
            data: {
              status: 'BANNED',
              bannedAt: new Date(),
              bannedReason: measures.banReason ?? input.note ?? '举报核实处置',
            },
          });
          measureNotes.push('用户已封禁');
        }
      }
    });

    // 通知（事务后）：举报人 + 被处置方
    const title = snap?.targetTitle ?? input.targetId;
    const resultText =
      input.action === 'DISMISS'
        ? `未违规驳回${input.note ? `：${input.note}` : ''}`
        : measureNotes.length
          ? measureNotes.join('、')
          : '已核实处理';
    for (const r of open) {
      await notifyService.createNotification(
        r.reporterId,
        'SYSTEM',
        `你的举报已处理：<b>${title?.slice(0, 60)}</b> —— ${resultText}`,
      );
    }
    if (input.action === 'RESOLVE' && snap?.targetAuthorId && measureNotes.length) {
      await notifyService.createNotification(
        snap.targetAuthorId,
        'SYSTEM',
        `你发布的内容因举报核实被处置：<b>${title?.slice(0, 60)}</b> —— ${resultText}`,
      );
    }

    return { targetType: input.targetType, targetId: input.targetId, status, handled: open.length };
  },
};
