import { prisma } from '@/server/db';
import { presignGetInline } from '@/server/storage/minio';

/** 头像 302 代理（V3-5）：有 avatarKey → 302 内联签名（1h）；无 → 404（前端回退色块首字母） */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await prisma.user.findFirst({
    where: { id: params.id, deletedAt: null },
    select: { avatarKey: true },
  });
  if (!user?.avatarKey) return new Response('no avatar', { status: 404 });
  const url = await presignGetInline(user.avatarKey);
  return new Response(null, {
    status: 302,
    headers: { Location: url, 'Cache-Control': 'public, max-age=3600' },
  });
}
