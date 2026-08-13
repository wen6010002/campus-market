// 收益算法（纯函数，单测重点）：平台抽成 + T+N 结算。
export const PLATFORM_FEE_RATE = Number(process.env.PLATFORM_FEE_RATE ?? 0.1);
export const INCOME_SETTLE_DAYS = Number(process.env.INCOME_SETTLE_DAYS ?? 7);

/**
 * 抽成拆分（以「分」为整数运算，避免浮点误差）。
 * price 单位：元（如 9.9）。返回单位：元（两位小数）。
 */
export function splitFee(price: number): { platformFee: number; creatorAmount: number } {
  const priceCents = Math.round(price * 100);
  const platformFeeCents = Math.round(priceCents * PLATFORM_FEE_RATE);
  const creatorAmountCents = priceCents - platformFeeCents;
  return { platformFee: platformFeeCents / 100, creatorAmount: creatorAmountCents / 100 };
}

/** 结算时间 = 支付时间 + T+N 天 */
export function settleAt(paidAt: Date): Date {
  return new Date(paidAt.getTime() + INCOME_SETTLE_DAYS * 86400_000);
}
