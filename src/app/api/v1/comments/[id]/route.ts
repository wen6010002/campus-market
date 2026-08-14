import { withErrorHandler, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { commentService } from '@/server/services/comment.service';

type Ctx = { params: { id: string } };

export const DELETE = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const s = await requireUser();
  const result = await commentService.remove(ctx.params.id, s.userId, s.role === 'ADMIN');
  return ok(result);
});
