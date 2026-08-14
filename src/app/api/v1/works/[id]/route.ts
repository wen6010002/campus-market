import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { workService } from '@/server/services/work.service';
import { getSession, requireUser, requireAdmin } from '@/server/auth/session';
import { workInputSchema } from '@/lib/zod/work';

type Ctx = { params: { id: string } };

export const GET = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const session = await getSession();
  const work = await workService.get(ctx.params.id, session?.userId, session?.role);
  return ok(work);
});

export const PUT = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const s = await requireUser();
  const input = workInputSchema.parse(await readJson(req));
  const work = await workService.update(ctx.params.id, s.userId, input);
  return ok(work);
});

export const DELETE = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const s = await requireUser();
  const isAdmin = s.role === 'ADMIN';
  await workService.remove(ctx.params.id, s.userId, isAdmin);
  return ok({ ok: true });
});
