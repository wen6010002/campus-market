import { withErrorHandler, ok } from '@/server/lib/http';
import { workService } from '@/server/services/work.service';
import { getSession } from '@/server/auth/session';

/** 在线预览（V3-4）：POST 允许匿名（middleware 单独放行本路径）。
 *  免费作品签原文件全量；付费未购签 5 页试读副本；点击即计一次观看（去重）。 */
export const POST = withErrorHandler(
  async (req: Request, { params }: { params: { id: string } }) => {
    const session = await getSession();
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';
    const result = await workService.getPreview(params.id, session?.userId, ip);
    return ok(result);
  },
);
