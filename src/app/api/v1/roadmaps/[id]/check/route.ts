import { withErrorHandler, ok, readJson } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { roadmapService } from '@/server/services/roadmap.service';
import { roadmapCheckSchema } from '@/lib/zod/roadmap';

export const POST = withErrorHandler(async (req: Request, ctx: { params: { id: string } }) => {
  const s = await requireUser();
  const { stepId, checked } = roadmapCheckSchema.parse(await readJson(req));
  return ok(await roadmapService.toggleCheck(s.userId, ctx.params.id, stepId, checked));
});
