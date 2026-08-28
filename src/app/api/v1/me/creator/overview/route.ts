import { withErrorHandler, ok } from '@/server/lib/http';
import { ensurePublisher } from '@/server/auth/session';
import { creatorService } from '@/server/services/creator.service';

export const GET = withErrorHandler(async () => {
  const s = await ensurePublisher();
  return ok(await creatorService.overview(s.userId));
});
