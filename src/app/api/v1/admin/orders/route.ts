import { withErrorHandler } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { adminService } from '@/server/services/admin.service';
import { okPage } from '@/server/lib/http';

export const GET = withErrorHandler(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const result = await adminService.listOrders({
    page: Number(url.searchParams.get('page') ?? 1),
    pageSize: Number(url.searchParams.get('pageSize') ?? 20),
    payStatus: url.searchParams.get('payStatus') ?? undefined,
    q: url.searchParams.get('q') ?? undefined,
  });
  return okPage(result.data, result.pagination);
});
