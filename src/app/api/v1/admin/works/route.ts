import { withErrorHandler } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { adminService } from '@/server/services/admin.service';
import { okPage } from '@/server/lib/http';

const GET = withErrorHandler(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const fine = url.searchParams.get('fine');
  const result = await adminService.listWorks({
    page: Number(url.searchParams.get('page') ?? 1),
    pageSize: Number(url.searchParams.get('pageSize') ?? 20),
    q: url.searchParams.get('q') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    authorId: url.searchParams.get('authorId') ?? undefined,
    category: url.searchParams.get('category') ?? undefined,
    ...(fine === 'true' || fine === 'false' ? { fine } : {}),
  });
  return okPage(result.data, result.pagination);
});

export { GET };
