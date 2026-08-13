import { withErrorHandler, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { orderService } from '@/server/services/order.service';

type Ctx = { params: { id: string } };

export const GET = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const s = await requireUser();
  const order = await orderService.get(ctx.params.id, s.userId);
  return ok(order);
});
