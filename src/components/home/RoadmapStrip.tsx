'use client';

import Link from 'next/link';
import { useRoadmaps } from '@/hooks/useRoadmaps';
import { formatNum } from '@/lib/format';

/**
 * 官方路线图（V10，替代 HomeRoadmapBanner 渐变横幅+横滑卡片）：
 * 紧凑行形态（紫色左缘条），一屏扫完。数据 hook 沿用收藏排序。
 */
export function RoadmapStrip() {
  const top = useRoadmaps({ page: 1, pageSize: 5, sort: 'favs' });
  const items = top.data?.data ?? [];
  if (!top.isLoading && !items.length) return null;

  return (
    <section className="blog-sec" style={{ marginBottom: 0 }}>
      <div className="blog-sec-head">
        <h2>🧭 官方路线图</h2>
        <Link className="bs-more" href="/roadmaps">
          全部路线 →
        </Link>
      </div>
      <p className="blog-sec-sub">跟着走就行，每一步可打卡</p>
      {top.isLoading ? (
        <div style={{ color: 'var(--ink-soft)', padding: '24px 0', textAlign: 'center' }}>
          加载中…
        </div>
      ) : (
        items.map((r) => (
          <Link key={r.id} className="rm-row" href={`/roadmaps/${r.id}`}>
            <span className="rm-emoji">{r.coverIcon}</span>
            <span className="rm-title">{r.title}</span>
            <span className="rm-sub">
              👁 {formatNum(r.favs)} 收藏 · {r.stepsCount} 步
            </span>
          </Link>
        ))
      )}
    </section>
  );
}
