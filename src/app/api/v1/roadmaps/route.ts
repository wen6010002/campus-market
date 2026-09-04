import { withErrorHandler, ok, okPage, readJson } from '@/server/lib/http';
import { getSession, requireUser } from '@/server/auth/session';
import { roadmapService } from '@/server/services/roadmap.service';
import { roadmapQuerySchema, roadmapInputSchema } from '@/lib/zod/roadmap';

export const GET = withErrorHandler(async (req: Request) => {
  const query = roadmapQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams.entries()));
  const result = await roadmapService.list(query);
  return okPage(result.data, result.pagination);
});

export const POST = withErrorHandler(async (req: Request) => {
  const s = await requireUser();
  const input = roadmapInputSchema.parse(await readJson(req));
  return ok(await roadmapService.create(s.userId, s.role, input), { status: 201 });
});
