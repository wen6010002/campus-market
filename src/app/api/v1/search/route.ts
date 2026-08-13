import { withErrorHandler, ok } from '@/server/lib/http';
import { searchService } from '@/server/services/search.service';

export const GET = withErrorHandler(async (req: Request) => {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  const result = await searchService.search(q);
  return ok(result);
});
