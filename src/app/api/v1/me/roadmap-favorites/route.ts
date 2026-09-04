import { withErrorHandler, okPage } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { roadmapService } from '@/server/services/roadmap.service';

export const GET = withErrorHandler(async (req: Request) => {
  const s = await requireUser();
  const url = new URL(req.url);
  const page = Number(url.searchParams.get('page') ?? 1);
  const pageSize = Number(url.searchParams.get('pageSize') ?? 20);
  const result = await roadmapService.myFavorites(s.userId, page, pageSize);
  return okPage(result.data, result.pagination);
});
