import { withErrorHandler, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { achievementService } from '@/server/services/achievement.service';

export const GET = withErrorHandler(async () => {
  const s = await requireUser();
  return ok(await achievementService.listForUser(s.userId));
});
