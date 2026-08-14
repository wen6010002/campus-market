import { prisma } from '../db';
import { appError } from '../lib/errors';
import { sanitize } from '../lib/sanitize';

export const commentService = {
  /** 评论列表（公开，分页） */
  async list(workId: string, page: number, pageSize: number) {
    const where = { workId, deletedAt: null };
    const [total, comments] = await Promise.all([
      prisma.comment.count({ where }),
      prisma.comment.findMany({
        where,
        include: { user: { select: { id: true, username: true, avatarColor: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      data: comments.map((c) => ({
        id: c.id,
        content: c.content,
        likes: c.likes,
        createdAt: c.createdAt.toISOString(),
        user: c.user,
        parentId: c.parentId,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  },

  /** 发评论（登录，content 白名单清洗） */
  async create(userId: string, workId: string, content: string, parentId?: string) {
    const work = await prisma.work.findFirst({
      where: { id: workId, deletedAt: null, status: 'PUBLISHED' },
    });
    if (!work) throw appError('NOT_FOUND', '作品不存在');
    const comment = await prisma.comment.create({
      data: { workId, userId, content: sanitize(content), parentId: parentId ?? null },
      include: { user: { select: { id: true, username: true, avatarColor: true } } },
    });
    return {
      id: comment.id,
      content: comment.content,
      likes: comment.likes,
      createdAt: comment.createdAt.toISOString(),
      user: comment.user,
      parentId: comment.parentId,
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
};
