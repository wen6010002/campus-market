import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { commentService } from '@/server/services/comment.service';

type Ctx = { params: { id: string } };

const createSchema = z.object({
  content: z.string().trim().min(1).max(600),
  parentId: z.string().optional(),
});

export const GET = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const url = new URL(req.url);
  const result = await commentService.list(
    ctx.params.id,
    Number(url.searchParams.get('page') ?? 1),
    Number(url.searchParams.get('pageSize') ?? 20),
  );
  return NextResponse.json({ data: result.data, pagination: result.pagination });
});

export const POST = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const s = await requireUser();
  const { content, parentId } = createSchema.parse(await readJson(req));
  const comment = await commentService.create(s.userId, ctx.params.id, content, parentId);
  return ok(comment, { status: 201 });
});
