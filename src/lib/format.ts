// 展示格式化工具 —— 契约 §0.2：金额是字符串、时间 ISO、数字千分位。
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

/** 金额字符串 → "¥9.90"（不做浮点运算，仅展示） */
export function formatCny(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '¥0.00';
  const n = typeof v === 'string' ? Number(v) : v;
  return `¥${n.toFixed(2)}`;
}

/** 千分位数字 */
export function formatNum(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '0';
  return Number(v).toLocaleString();
}

/** ISO 时间 → 相对时间（"2 小时前"） */
export function timeAgo(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  return dayjs(iso).fromNow();
}

/** 评分均值字符串（如 "4.9"）→ 保留 1 位 */
export function formatRating(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '0.0';
  return Number(v).toFixed(1);
}
