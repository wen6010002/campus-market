import { withErrorHandler, ok } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { workService } from '@/server/services/work.service';

type Ctx = { params: { id: string } };

/** 管理员审核下载：绕开购买/状态门槛，直接预签名返回文件链接 */
export const POST = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  await requireAdmin();
  const result = await workService.adminDownload(ctx.params.id);
  return ok(result);
});
