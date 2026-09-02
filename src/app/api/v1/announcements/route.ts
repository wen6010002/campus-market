import { withErrorHandler, okPage } from '@/server/lib/http';
import { getSession } from '@/server/auth/session';
import { announceService } from '@/server/services/announce.service';
import { announceQuerySchema } from '@/lib/zod/announce';

export const GET = withErrorHandler(async (req: Request) => {
  const query = announceQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams.entries()));
  // 公开接口：unread 过滤需要身份；未登录请求 unread 时返回空列表而非 401（更稳，防弹窗组件误触发报错）
  const session = await getSession();
  if (query.unread && !session) {
    return okPage([], { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 });
  }
  const result = await announceService.list(query, session?.userId);
  return okPage(result.data, result.pagination);
});
