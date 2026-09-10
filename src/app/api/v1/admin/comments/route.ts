import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { commentService } from '@/server/services/comment.service';

/** 评论审核队列（V12）：status=PENDING_REVIEW（默认，最早的先处理）| REJECTED（日志，最新在前）。
 *  附带重点观察名单：7 天内被拒 ≥3 次的用户。 */
export const GET = withErrorHandler(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const status = url.searchParams.get('status') === 'REJECTED' ? 'REJECTED' : 'PENDING_REVIEW';
  const result = await commentService.adminList(
    status,
    Number(url.searchParams.get('page') ?? 1),
    Number(url.searchParams.get('pageSize') ?? 20),
  );
  return NextResponse.json({
    data: result.data,
    pagination: result.pagination,
    watchlist: result.watchlist,
  });
});
