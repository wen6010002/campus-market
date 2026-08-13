import { withErrorHandler, ok } from '@/server/lib/http';
import { workService } from '@/server/services/work.service';
import { requireUser } from '@/server/auth/session';

type Ctx = { params: { id: string } };

export const POST = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const s = await requireUser();
  const work = await workService.publish(ctx.params.id, s.userId);
  return ok(work);
});
