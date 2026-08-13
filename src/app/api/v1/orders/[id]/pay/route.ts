import { withErrorHandler, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { orderService } from '@/server/services/order.service';

type Ctx = { params: { id: string } };

export const POST = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const s = await requireUser();
  const result = await orderService.pay(ctx.params.id, s.userId);
  return ok(result);
});
