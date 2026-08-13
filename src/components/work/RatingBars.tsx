import type { RatingDist } from '@/lib/types';

/** 评分分布横条（对应原型 .rating-dist） */
export function RatingBars({ dist, total }: { dist: RatingDist; total: number }) {
  const order = ['5', '4', '3', '2', '1'] as const;
  return (
    <div className="rating-dist">
      {order.map((star) => {
        const count = dist[star] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={star} className="rd-row">
            <span className="rd-label">{star} 星</span>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="rd-count">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
