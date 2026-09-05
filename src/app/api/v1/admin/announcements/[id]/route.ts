import { withErrorHandler, ok, readJson } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { announceService } from '@/server/services/announce.service';
import { announceInputSchema } from '@/lib/zod/announce';
import { z } from 'zod';

type Ctx = { params: { id: string } };

const patchSchema = announceInputSchema.extend({
  /** 撤回中的公告编辑后重新上架 */
  republish: z.boolean().optional().default(false),
});

export const PATCH = withErrorHandler(async (req: Request, ctx: Ctx) => {
  await requireAdmin();
  const { republish, ...input } = patchSchema.parse(await readJson(req));
  return ok(await announceService.update(ctx.params.id, input, republish));
});

export const DELETE = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  await requireAdmin();
  return ok(await announceService.unpublish(ctx.params.id));
});
