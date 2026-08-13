import { withErrorHandler, ok } from '@/server/lib/http';
import { requireCreator } from '@/server/auth/session';
import { creatorService } from '@/server/services/creator.service';

export const GET = withErrorHandler(async () => {
  const s = await requireCreator();
  return ok(await creatorService.data(s.userId));
});
