import { withErrorHandler, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { roadmapService } from '@/server/services/roadmap.service';

/** 我的站内打卡统计（V12）：{today, streakDays, totalDays, byDay}——
 *  打卡榜「我的」卡与个人中心共用 */
export const GET = withErrorHandler(async () => {
  const s = await requireUser();
  return ok(await roadmapService.checkinStats(s.userId));
});
