import { NextResponse } from 'next/server';
import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { requireUser, getSession } from '@/server/auth/session';
import { commentService } from '@/server/services/comment.service';
import { createCommentSchema } from '@/lib/zod/comment';

type Ctx = { params: { id: string } };

/** 路线图评论列表（V12，公开；登录者另见自己的待审行） */
export const GET = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const url = new URL(req.url);
  const s = await getSession();
  const result = await commentService.list(
    'ROADMAP',
    ctx.params.id,
    Number(url.searchParams.get('page') ?? 1),
    Number(url.searchParams.get('pageSize') ?? 20),
    s?.userId,
  );
  return NextResponse.json({ data: result.data, pagination: result.pagination });
});

export const POST = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const s = await requireUser();
  const { content, parentId } = createCommentSchema.parse(await readJson(req));
  const comment = await commentService.create(
    s.userId,
    'ROADMAP',
    ctx.params.id,
    content,
    parentId,
  );
  return ok(comment, { status: 201 });
});
