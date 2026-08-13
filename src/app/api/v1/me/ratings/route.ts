import { withErrorHandler, ok } from '@/server/lib/http';
import { ratingService } from '@/server/services/rating.service';
import { requireUser } from '@/server/auth/session';

export const GET = withErrorHandler(async () => {
  const s = await requireUser();
  return ok(await ratingService.meRatings(s.userId));
});
