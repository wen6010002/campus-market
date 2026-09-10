import { z } from 'zod';
import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { commentService } from '@/server/services/comment.service';

const handleSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
});

/** 管理员处置评论（V12）：APPROVE 放行（首次放行补发 owner 通知）/ REJECT 拒绝并通知作者 */
export const POST = withErrorHandler(
  async (req: Request, ctx: { params: { id: string } }) => {
    const admin = await requireAdmin();
    const { action } = handleSchema.parse(await readJson(req));
    return ok(await commentService.adminHandle(ctx.params.id, action, admin.userId));
  },
  { strictOrigin: true },
);
