import { withErrorHandler, ok } from '@/server/lib/http';
import { workService } from '@/server/services/work.service';

type Ctx = { params: { id: string } };

export const GET = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const related = await workService.related(ctx.params.id);
  return ok(related);
});
