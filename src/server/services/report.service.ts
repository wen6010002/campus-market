import { prisma } from '../db';
import { appError } from '../lib/errors';
import { sanitize } from '../lib/sanitize';
import { enforceRateLimit } from '../lib/ratelimit';
import type { ReportTargetType, ReportReason, ReportStatus } from '@/lib/constants';

export const reportService = {
  /** 举报（登录，每用户 5/小时限流） */
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
    const report = await prisma.report.create({
      data: {
        reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        detail: input.detail ? sanitize(input.detail) : null,
        status: 'OPEN',
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

  /** 举报队列（ADMIN） */
  async adminList() {
    const reports = await prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      include: { reporter: { select: { username: true } } },
    });
    return reports.map((r) => ({
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      detail: r.detail,
      status: r.status,
      reporter: r.reporter.username,
      createdAt: r.createdAt.toISOString(),
      handleNote: r.handleNote,
      handledAt: r.handledAt?.toISOString() ?? null,
    }));
  },

  /** 处理举报（ADMIN） */
  async adminHandle(
    reportId: string,
    status: ReportStatus,
    note: string | undefined,
    adminId: string,
  ) {
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw appError('NOT_FOUND', '举报不存在');
    const updated = await prisma.report.update({
      where: { id: reportId },
      data: { status, handleNote: note ?? null, handlerId: adminId, handledAt: new Date() },
    });
    return {
      id: updated.id,
      targetType: updated.targetType,
      targetId: updated.targetId,
      reason: updated.reason,
      status: updated.status,
      handleNote: updated.handleNote,
      handledAt: updated.handledAt?.toISOString() ?? null,
    };
  },
};
