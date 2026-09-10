/**
 * 北京时间（UTC+8）的 'YYYY-MM-DD' —— 全站打卡按日聚合的统一口径。
 * 服务端（roadmap.service 等）与客户端（useRoadmaps 乐观更新）共用，
 * 纯函数无依赖，两端行为必须一致（改一处改两处）。
 */
export function dayCn8(d: Date): string {
  const t = new Date(d.getTime() + 8 * 3600_000);
  return t.toISOString().slice(0, 10);
}
