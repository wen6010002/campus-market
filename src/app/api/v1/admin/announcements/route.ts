import { withErrorHandler, ok, okPage, readJson } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { announceService } from '@/server/services/announce.service';
import { announceInputSchema } from '@/lib/zod/announce';

export const GET = withErrorHandler(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const page = Number(url.searchParams.get('page') ?? 1);
  const pageSize = Number(url.searchParams.get('pageSize') ?? 20);
  const result = await announceService.adminList(page, pageSize);
  return okPage(result.data, result.pagination);
});

export const POST = withErrorHandler(async (req: Request) => {
  const s = await requireAdmin();
  const input = announceInputSchema.parse(await readJson(req));
  return ok(await announceService.publish(s.userId, input), { status: 201 });
});
