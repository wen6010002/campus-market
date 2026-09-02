import { prisma } from '../db';
import { appError } from '../lib/errors';
import { enforceRateLimit } from '../lib/ratelimit';
import { getObjectText, presignGet, presignGetInline, objectExists } from '../storage/minio';
import { notifyService } from './notify.service';
import { workService } from './work.service';
import { cacheGet, cacheSet, cacheDelByPattern } from '../lib/cache';
import { parseRoadmapMd, validateRoadmap, type RoadmapContent } from '@/lib/roadmap/parse';
import type { RoadmapInput, RoadmapQuery } from '@/lib/zod/roadmap';
import type { Roadmap } from '@prisma/client';

// 学习路线图服务（V4）：md 上传 → 服务端解析为结构化 todolist；打卡 = 勾选步骤；
// 状态机复用 WorkStatus：ADMIN 上传直接 PUBLISHED，普通用户 PENDING → 审核 → PUBLISHED/REJECTED（单向，无编辑）。
// 性能（V4.1）：列表 60s 缓存（上架/审核通过时失效；收藏数变化容忍 TTL 内漂移，同 works:list 模式）；
// PUBLISHED 详情的公共部分（content+works）内容不可变，300s 缓存，myFav 按访问者单独查。

const UPLOADER_SELECT = { id: true, username: true, role: true, avatarColor: true, avatarKey: true, updatedAt: true };

type RoadmapWithUploader = Roadmap & {
  uploader: { id: string; username: string; role: string; avatarColor: string; avatarKey: string | null; updatedAt: Date };
};

/** 详情公共部分（不含 myFav，按访问者叠加） */
type RoadmapDetail = ReturnType<typeof toListItem> & {
  content: RoadmapContent;
  works: unknown[];
  experience: string | null;
  hasCredential: boolean;
};

function toListItem(r: RoadmapWithUploader, myFav = false) {
  return {
    id: r.id,
    title: r.title,
    summary: r.summary,
    category: r.category,
    coverIcon: r.coverIcon,
    coverTheme: r.coverTheme,
    status: r.status,
    stepsCount: r.stepsCount,
    favs: r.favs,
    uploader: {
      id: r.uploader.id,
      username: r.uploader.username,
      role: r.uploader.role,
      hasAvatar: !!r.uploader.avatarKey,
      avatarVer: r.uploader.updatedAt.getTime(),
    },
    publishedAt: r.publishedAt?.toISOString() ?? null,
    rejectedReason: r.rejectedReason,
    createdAt: r.createdAt.toISOString(),
    myFav,
  };
}

/** 北京时间（UTC+8）的 'YYYY-MM-DD'——打卡按日聚合的统一口径 */
function dayCn8(d: Date): string {
  const t = new Date(d.getTime() + 8 * 3600_000);
  return t.toISOString().slice(0, 10);
}

async function assertStepExists(content: unknown, stepId: string) {
  const phases = ((content as RoadmapContent)?.phases ?? []) as RoadmapContent['phases'];
  for (let pi = 0; pi < phases.length; pi++) {
    const step = phases[pi].steps.find((s) => s.id === stepId);
    if (step) return { phaseIdx: pi, step };
  }
  throw appError('VALIDATION', '该步骤不存在');
}

export const roadmapService = {
  /** 列表（公开，仅 PUBLISHED） */
  async list(q: RoadmapQuery) {
    const cacheKey = `roadmaps:list:${JSON.stringify(q)}`;
    const cached = await cacheGet<Awaited<ReturnType<typeof queryList>>>(cacheKey);
    if (cached) return cached;
    const result = await queryList(q);
    await cacheSet(cacheKey, result, 60);
    return result;
  },

  /** 详情（公开 PUBLISHED；PENDING/REJECTED 仅上传者与 ADMIN；附 myFav 与关联资料） */
  async get(id: string, viewerId?: string, viewerRole?: string) {
    // PUBLISHED 的公共部分内容不可变 → 300s 缓存；myFav 按访问者叠加
    const cacheKey = `roadmap:detail:${id}`;
    const base = await cacheGet<RoadmapDetail>(cacheKey);
    if (base) {
      const myFav = viewerId
        ? !!(await prisma.roadmapFavorite.findUnique({
            where: { userId_roadmapId: { userId: viewerId, roadmapId: id } },
          }))
        : false;
      return { ...base, myFav };
    }

    const r = await prisma.roadmap.findFirst({
      where: { id, deletedAt: null },
      include: {
        uploader: { select: UPLOADER_SELECT },
        workLinks: { orderBy: { sortNo: 'asc' }, select: { workId: true } },
      },
    });
    if (!r) throw appError('NOT_FOUND', '路线图不存在');
    if (r.status !== 'PUBLISHED' && r.uploaderId !== viewerId && viewerRole !== 'ADMIN') {
      throw appError('FORBIDDEN', '该路线图尚未上架');
    }

    const works = await workService.byIds(r.workLinks.map((l) => l.workId));
    const myFav = viewerId
      ? !!(await prisma.roadmapFavorite.findUnique({
          where: { userId_roadmapId: { userId: viewerId, roadmapId: id } },
        }))
      : false;

    const detail: RoadmapDetail = {
      ...toListItem(r),
      content: r.content as unknown as RoadmapContent,
      works,
      experience: r.experience,
      hasCredential: !!r.credentialKey,
    };
    if (r.status === 'PUBLISHED') await cacheSet(cacheKey, detail, 300);
    return { ...detail, myFav };
  },

  /** 上传（登录；ADMIN 直接发布，普通用户进审核并必须提交学生证+经历） */
  async create(userId: string, role: string, input: RoadmapInput) {
    await enforceRateLimit(`rl:roadmap:create:${userId}`, 5, 3600_000);

    const isAdmin = role === 'ADMIN';
    if (!isAdmin && (!input.credentialKey || !input.experience)) {
      throw appError('VALIDATION', '学生上传路线图需同时提交学生证照片与个人经历，供审核员核实');
    }
    if (input.credentialKey && !(await objectExists(input.credentialKey))) {
      throw appError('NOT_FOUND', '学生证文件不存在，请重新上传');
    }

    // 服务端从 MinIO 拉取 md 原文重新解析（不信任前端预览结果）
    let md: string;
    try {
      md = await getObjectText(input.mdSourceKey);
    } catch {
      throw appError('NOT_FOUND', '路线图文件不存在，请重新上传');
    }
    const parsed = parseRoadmapMd(md);
    const invalid = validateRoadmap(parsed);
    if (invalid || !parsed.ok) throw appError('VALIDATION', invalid ?? '路线图格式错误');

    // 校验关联资料存在且已上架
    if (input.workIds.length) {
      const okWorks = await prisma.work.count({
        where: { id: { in: input.workIds }, status: 'PUBLISHED', deletedAt: null },
      });
      if (okWorks !== input.workIds.length) {
        throw appError('VALIDATION', '关联资料中包含不存在或未上架的作品');
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const r = await tx.roadmap.create({
        data: {
          title: input.title,
          summary: input.summary,
          category: input.category,
          coverIcon: input.coverIcon ?? '🗺',
          coverTheme: input.coverTheme ?? 'g-default',
          uploaderId: userId,
          status: isAdmin ? 'PUBLISHED' : 'PENDING',
          stepsCount: parsed.stepsCount,
          content: parsed.content as any,
          mdSourceKey: input.mdSourceKey,
          credentialKey: input.credentialKey ?? null,
          experience: isAdmin ? null : input.experience,
          publishedAt: isAdmin ? new Date() : null,
        },
      });
      if (input.workIds.length) {
        await tx.roadmapWorkLink.createMany({
          data: input.workIds.map((workId, i) => ({ roadmapId: r.id, workId, sortNo: i })),
        });
      }
      return r;
    });
    if (isAdmin) await invalidateRoadmapListCaches(); // 直发上架 → 列表立即可见

    return {
      id: created.id,
      status: created.status,
      message: isAdmin ? '已直接发布' : '已提交审核，审核结果将通过通知告知',
    };
  },

  /** 收藏/取消（幂等 set，照抄 social.service.setFavorite 模式） */
  async setFavorite(userId: string, roadmapId: string, value: boolean) {
    const r = await prisma.roadmap.findFirst({ where: { id: roadmapId, deletedAt: null } });
    if (!r) throw appError('NOT_FOUND', '路线图不存在');

    return prisma.$transaction(async (tx) => {
      const existing = await tx.roadmapFavorite.findUnique({
        where: { userId_roadmapId: { userId, roadmapId } },
      });
      if (value && !existing) {
        await tx.roadmapFavorite.create({ data: { userId, roadmapId } });
        await tx.roadmap.update({ where: { id: roadmapId }, data: { favs: { increment: 1 } } });
      } else if (!value && existing) {
        await tx.roadmapFavorite.delete({ where: { userId_roadmapId: { userId, roadmapId } } });
        await tx.roadmap.update({ where: { id: roadmapId }, data: { favs: { decrement: 1 } } });
      }
      const after = await tx.roadmap.findUniqueOrThrow({
        where: { id: roadmapId },
        select: { favs: true },
      });
      return { favorited: value, favs: after.favs };
    });
  },

  /** 打卡（勾选步骤=insert / 取消=delete；校验 stepId 属于该路线图） */
  async toggleCheck(userId: string, roadmapId: string, stepId: string, checked: boolean) {
    await enforceRateLimit(`rl:check:${userId}`, 60, 60_000);

    const r = await prisma.roadmap.findFirst({ where: { id: roadmapId, deletedAt: null } });
    if (!r) throw appError('NOT_FOUND', '路线图不存在');
    const { phaseIdx } = await assertStepExists(r.content, stepId);
    const stepIdx = Number(stepId.split('-s')[1]);

    if (checked) {
      await prisma.roadmapCheck.upsert({
        where: { userId_roadmapId_stepId: { userId, roadmapId, stepId } },
        update: {},
        create: { userId, roadmapId, stepId, phaseIdx, stepIdx },
      });
    } else {
      await prisma.roadmapCheck.deleteMany({ where: { userId, roadmapId, stepId } });
    }
    return { stepId, checked };
  },

  /** 我的进度：勾选列表 + 按日聚合（UTC+8）+ 连续天数 */
  async progress(userId: string, roadmapId: string) {
    const r = await prisma.roadmap.findFirst({
      where: { id: roadmapId, deletedAt: null },
      select: { stepsCount: true },
    });
    if (!r) throw appError('NOT_FOUND', '路线图不存在');

    const checks = await prisma.roadmapCheck.findMany({
      where: { userId, roadmapId },
      orderBy: { createdAt: 'asc' },
    });

    const byDay: Record<string, number> = {};
    for (const c of checks) {
      const day = dayCn8(c.createdAt);
      byDay[day] = (byDay[day] ?? 0) + 1;
    }

    // 连续打卡天数：从今天（UTC+8）往前数；今天没打则从昨天起算（streak 不断在昨天截止）
    let streakDays = 0;
    const today = dayCn8(new Date());
    let cursor = new Date();
    if (!byDay[today]) cursor = new Date(Date.now() - 86400_000);
    for (let i = 0; i < 366; i++) {
      const day = dayCn8(cursor);
      if (byDay[day]) {
        streakDays++;
        cursor = new Date(cursor.getTime() - 86400_000);
      } else break;
    }

    return {
      roadmapId,
      checked: checks.map((c) => ({ stepId: c.stepId, createdAt: c.createdAt.toISOString() })),
      byDay,
      streakDays,
      totalChecked: checks.length,
      stepsCount: r.stepsCount,
    };
  },

  /** 我收藏的路线图（/me/roadmap-favorites，V4） */
  async myFavorites(userId: string, page: number, pageSize: number) {
    const where = {
      userId,
      roadmap: { status: 'PUBLISHED' as const, deletedAt: null },
    };
    const [total, favorites] = await Promise.all([
      prisma.roadmapFavorite.count({ where }),
      prisma.roadmapFavorite.findMany({
        where,
        include: { roadmap: { include: { uploader: { select: UPLOADER_SELECT } } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      data: favorites.map((f) => toListItem(f.roadmap as RoadmapWithUploader, true)),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  },

  /** 管理端：待审核列表 */
  async adminPending() {
    const items = await prisma.roadmap.findMany({
      where: { status: 'PENDING', deletedAt: null },
      include: { uploader: { select: UPLOADER_SELECT } },
      orderBy: { createdAt: 'asc' },
    });
    return items.map((r) => ({
      ...toListItem(r),
      experience: r.experience,
      hasCredential: !!r.credentialKey,
    }));
  },

  /** 管理端：审核详情（解析内容 + 学生证预签名图 + md 下载链接） */
  async adminGet(id: string) {
    const r = await prisma.roadmap.findFirst({
      where: { id, deletedAt: null },
      include: {
        uploader: { select: UPLOADER_SELECT },
        workLinks: { orderBy: { sortNo: 'asc' }, select: { workId: true } },
      },
    });
    if (!r) throw appError('NOT_FOUND', '路线图不存在');

    const [credentialUrl, mdUrl, works] = await Promise.all([
      r.credentialKey ? presignGetInline(r.credentialKey) : Promise.resolve(null),
      presignGet(r.mdSourceKey, `${r.title}.md`),
      workService.byIds(r.workLinks.map((l) => l.workId)),
    ]);

    return {
      ...toListItem(r),
      content: r.content as unknown as RoadmapContent,
      works,
      experience: r.experience,
      credentialUrl,
      mdUrl,
    };
  },

  /** 管理端：审核（APPROVE → PUBLISHED / REJECT → REJECTED；通知上传者） */
  async adminAudit(id: string, action: 'APPROVE' | 'REJECT', note: string | undefined, adminId: string) {
    const r = await prisma.roadmap.findFirst({ where: { id, deletedAt: null } });
    if (!r) throw appError('NOT_FOUND', '路线图不存在');
    if (r.status !== 'PENDING') throw appError('VALIDATION', '该路线图不在待审核状态');

    const updated = await prisma.$transaction(async (tx) => {
      return tx.roadmap.update({
        where: { id },
        data: {
          status: action === 'APPROVE' ? 'PUBLISHED' : 'REJECTED',
          publishedAt: action === 'APPROVE' ? new Date() : null,
          rejectedReason: action === 'REJECT' ? (note ?? null) : null,
          reviewerId: adminId,
          reviewedAt: new Date(),
        },
      });
    });
    if (action === 'APPROVE') await invalidateRoadmapListCaches(); // 上架 → 列表立即可见

    await notifyService.createNotification(
      r.uploaderId,
      'AUDIT_RESULT',
      action === 'APPROVE'
        ? `你上传的路线图<b>${r.title}</b>已通过审核并上架`
        : `你上传的路线图<b>${r.title}</b>未通过审核${note ? `：${note}` : ''}`,
      `/roadmaps/${r.id}`,
    );

    return { id: updated.id, status: updated.status };
  },
};

/** 列表查询本体（cacheGet 的类型来源） */
async function queryList(q: RoadmapQuery) {
  const where: any = { status: 'PUBLISHED', deletedAt: null };
  if (q.category) where.category = q.category;

  const [total, roadmaps] = await Promise.all([
    prisma.roadmap.count({ where }),
    prisma.roadmap.findMany({
      where,
      include: { uploader: { select: UPLOADER_SELECT } },
      orderBy: q.sort === 'newest' ? { publishedAt: 'desc' } : { favs: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return {
    data: roadmaps.map((r) => toListItem(r)),
    pagination: {
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.ceil(total / q.pageSize),
    },
  };
}

/** 上架状态变化时失效路线图列表缓存 */
async function invalidateRoadmapListCaches() {
  await cacheDelByPattern('roadmaps:list:*');
}
