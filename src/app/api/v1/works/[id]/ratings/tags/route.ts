import { withErrorHandler, ok } from '@/server/lib/http';
import { ratingService } from '@/server/services/rating.service';

export const GET = withErrorHandler(async () => {
  return ok(await ratingService.tags());
});
