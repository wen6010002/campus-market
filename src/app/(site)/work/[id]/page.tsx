import { getSession } from '@/server/auth/session';
import { workService } from '@/server/services/work.service';
import type { WorkDetail } from '@/lib/types';
import WorkDetailClient from './WorkDetailClient';

/** 服务端直连 service 预取作品数据：点击进入时 RSC payload 即含完整内容，
 *  客户端不再出现「加载中…」闪烁；评论/相关/评分仍由客户端并行拉取 */
export default async function WorkDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  let initialWork: WorkDetail | null = null;
  try {
    initialWork = (await workService.get(params.id, session?.userId, session?.role)) as WorkDetail;
  } catch {
    initialWork = null; // 未找到 / 已下架，交给客户端兜底展示
  }
  return (
    <WorkDetailClient
      id={params.id}
      initialWork={initialWork}
      isAdmin={session?.role === 'ADMIN'}
    />
  );
}
