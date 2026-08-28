import { z } from 'zod';
import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { ensurePublisher } from '@/server/auth/session';
import { incomeService } from '@/server/services/income.service';
import { PayMethod } from '@/lib/constants';

const payoutSchema = z.object({
  amount: z.number().positive(),
  method: z.nativeEnum(PayMethod),
});

export const POST = withErrorHandler(async (req: Request) => {
  const s = await ensurePublisher();
  const { amount, method } = payoutSchema.parse(await readJson(req));
  const payout = await incomeService.payout(s.userId, amount, method);
  return ok(
    {
      id: payout.id,
      amount: payout.amount.toFixed(2),
      method: payout.method,
      status: payout.status,
      requestedAt: payout.requestedAt.toISOString(),
    },
    { status: 201 },
  );
});
