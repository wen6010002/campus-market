import { withErrorHandler, ok } from '@/server/lib/http';
import { workService } from '@/server/services/work.service';
import { CATEGORIES } from '@/lib/constants';
import type { CategoryKey } from '@/lib/constants';

// 分类下有内容的标签计数（公开）：GET /works/tags?category=CAMPUS
// 用途：首页新生区/explore 的标签 chips 自动隐藏没有作品的空标签（2026-09）。
export const GET = withErrorHandler(async (req: Request) => {
  const raw = new URL(req.url).searchParams.get('category') ?? undefined;
  const category = CATEGORIES.some((c) => c.key === raw) ? (raw as CategoryKey) : undefined;
  const rows = await workService.availableTags(category);
  return ok(rows);
});
