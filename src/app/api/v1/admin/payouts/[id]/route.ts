import { z } from 'zod';
import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { adminService } from '@/server/services/admin.service';

type Ctx = { params: { id: string } };

const auditSchema = z.object({
  action: z.enum(['complete', 'reject']),
  channelTxId: z.string().optional(),
  rejectionReason: z.string().optional(),
});

export const POST = withErrorHandler(async (req: Request, ctx: Ctx) => {
  await requireAdmin();
  const { action, channelTxId, rejectionReason } = auditSchema.parse(await readJson(req));
  const payout = await adminService.auditPayout(ctx.params.id, action, {
    channelTxId,
    rejectionReason,
  });
  return ok({ id: payout.id, status: payout.status, amount: payout.amount.toFixed(2) });
});
