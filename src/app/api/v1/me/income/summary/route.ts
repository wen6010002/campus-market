import { withErrorHandler, ok } from '@/server/lib/http';
import { ensurePublisher } from '@/server/auth/session';
import { incomeService } from '@/server/services/income.service';

export const GET = withErrorHandler(async () => {
  const s = await ensurePublisher();
  return ok(await incomeService.summary(s.userId));
});
