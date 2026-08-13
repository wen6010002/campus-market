import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { orderService } from '@/server/services/order.service';
import { createOrderSchema } from '@/lib/zod/order';

type Ctx = { params: { id: string } };

export const POST = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const s = await requireUser();
  const { payMethod } = createOrderSchema.parse(await readJson(req));
  const result = await orderService.createOrder(s.userId, ctx.params.id, payMethod);
  return ok(result, { status: 201 });
});
