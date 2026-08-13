import { withErrorHandler, readJson, ok, okPage } from '@/server/lib/http';
import { workService } from '@/server/services/work.service';
import { requireCreator, getSession } from '@/server/auth/session';
import { workQuerySchema, workInputSchema } from '@/lib/zod/work';

export const GET = withErrorHandler(async (req: Request) => {
  const query = workQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams.entries()));
  const session = await getSession();
  const result = await workService.list(query);
  return okPage(result.data, result.pagination);
});

export const POST = withErrorHandler(async (req: Request) => {
  const s = await requireCreator();
  const input = workInputSchema.parse(await readJson(req));
  const work = await workService.create(s.userId, input);
  return ok(work, { status: 201 });
});
