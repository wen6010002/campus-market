/**
 * V7 付费开关（支付封存）：PAYMENT_MODE=off 时全站免费。
 * 展示层一律「免费」、付费作品完整预览、登录即可下载；下单/支付接口拒绝。
 * 价格数据（works.price/isFree）不动，恢复付费（PAYMENT_MODE=epay）即原样复活。
 */
export const paymentsEnabled = () => (process.env.PAYMENT_MODE ?? 'mock') !== 'off';
