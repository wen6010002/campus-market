import { withErrorHandler, ok } from '@/server/lib/http';
import { workService } from '@/server/services/work.service';

/** 分类页二级维度：某大类下热门课程聚合（公开，缓存 60s） */
export const GET = withErrorHandler(async (req: Request) => {
  const category = new URL(req.url).searchParams.get('category') ?? undefined;
  const data = await workService.courses(category);
  return ok(data);
});
