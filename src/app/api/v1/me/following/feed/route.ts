import { withErrorHandler, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { socialService } from '@/server/services/social.service';

export const GET = withErrorHandler(async () => {
  const s = await requireUser();
  return ok(await socialService.followingFeed(s.userId));
});
