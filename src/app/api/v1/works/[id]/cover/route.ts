import { prisma } from '@/server/db';
import { presignGetInline } from '@/server/storage/minio';

/** 封面 302 代理：有 coverKey → 302 到 1h 内联签名 URL；无 → 404（前端回退 emoji 主题）。
 *  浏览器按 URL 缓存 1h，列表页无需在 API 响应里内嵌 presigned URL。 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const work = await prisma.work.findFirst({
    where: { id: params.id, deletedAt: null },
    select: { coverKey: true },
  });
  if (!work?.coverKey) {
    return new Response('no cover', { status: 404 });
  }
  const url = await presignGetInline(work.coverKey);
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
