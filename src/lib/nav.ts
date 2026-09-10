import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

/**
 * 返回上一页；无历史（新标签页 / 微信分享链接直接打开）时落到 fallback。
 * history.length 为 1 说明本 tab 没有可回退的站内记录，裸 router.back() 会原地不动。
 */
export function backOrHome(router: AppRouterInstance, fallback = '/') {
  if (typeof window !== 'undefined' && window.history.length > 1) router.back();
  else router.push(fallback);
}
