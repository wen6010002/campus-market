import { describe, it, expect } from 'vitest';
import { recalcRating } from '@/server/algos/rating';

const base = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };

describe('评分重算算法', () => {
  it('首次评分：均值=stars，计数=1', () => {
    const r = recalcRating(0, 0, 5, base);
    expect(r).toEqual({ rating: 5, ratingCount: 1, dist: { ...base, '5': 1 } });
  });

  it('追加评分：加权均值保留 1 位', () => {
    // 旧 4.5 * 10 条 + 新 5 → (45+5)/11 = 4.545 → 4.5
    const dist = { ...base, '5': 5, '4': 5 };
    const r = recalcRating(4.5, 10, 5, dist);
    expect(r.rating).toBe(4.5);
    expect(r.ratingCount).toBe(11);
    expect(r.dist['5']).toBe(6);
  });

  it('分布累计', () => {
    const r = recalcRating(4.0, 1, 3, { ...base, '4': 1 });
    expect(r.dist['3']).toBe(1);
    expect(r.dist['4']).toBe(1);
  });
});
