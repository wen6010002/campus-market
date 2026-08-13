import { NextResponse } from 'next/server';
import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { ratingService } from '@/server/services/rating.service';
import { requireUser } from '@/server/auth/session';
import { createRatingSchema } from '@/lib/zod/rating';

type Ctx = { params: { id: string } };

export const GET = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const url = new URL(req.url);
  const sort = url.searchParams.get('sort') ?? 'new';
  const page = Number(url.searchParams.get('page') ?? 1);
  const pageSize = Number(url.searchParams.get('pageSize') ?? 20);
  const result = await ratingService.list(ctx.params.id, sort, page, pageSize);
  return NextResponse.json({
    data: result.data,
    pagination: result.pagination,
    summary: result.summary,
  });
});

export const POST = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const s = await requireUser();
  const input = createRatingSchema.parse(await readJson(req));
  const rating = await ratingService.create(s.userId, ctx.params.id, input);
  return ok(rating, { status: 201 });
});
