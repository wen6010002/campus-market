import { describe, it, expect } from 'vitest';
import { splitFee, settleAt } from '@/server/algos/income';

describe('收益抽成算法', () => {
  it('9.9 → 平台 0.99 / 创作者 8.91', () => {
    expect(splitFee(9.9)).toEqual({ platformFee: 0.99, creatorAmount: 8.91 });
  });
  it('100 → 平台 10 / 创作者 90', () => {
    expect(splitFee(100)).toEqual({ platformFee: 10, creatorAmount: 90 });
  });
  it('0.1 → 平台 0.01 / 创作者 0.09（无浮点误差）', () => {
    expect(splitFee(0.1)).toEqual({ platformFee: 0.01, creatorAmount: 0.09 });
  });
  it('settleAt 加 7 天', () => {
    expect(settleAt(new Date('2026-08-01T00:00:00Z'))).toEqual(new Date('2026-08-08T00:00:00Z'));
  });
});
