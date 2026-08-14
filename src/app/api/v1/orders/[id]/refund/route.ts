import { z } from 'zod';
import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { orderService } from '@/server/services/order.service';

type Ctx = { params: { id: string } };

const refundSchema = z.object({ reason: z.string().max(200).optional() });

export const POST = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const s = await requireUser();
  const { reason } = refundSchema.parse(await readJson(req));
  const result = await orderService.refund(ctx.params.id, s.userId, {
    reason,
    isAdmin: s.role === 'ADMIN',
  });
  return ok(result);
});
