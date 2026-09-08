'use client';

import Link from 'next/link';
import { useWorks } from '@/hooks/useWorks';
import { FeedRow } from '@/components/work/FeedRow';
import { Empty } from '@/components/common/Empty';

/**
 * 编辑推荐（V10，替代「今日免费推荐」卡片网格）：常青内容用 emoji 块左列，
 * 与时间流的日期列形态区分语义。数据源沿用综合排序。
 */
export function EditorPicks() {
  const picks = useWorks({ page: 1, pageSize: 6, sort: 'complex', excludeCat: 'ABROAD' });
  const items = picks.data?.data ?? [];

  if (!picks.isLoading && !items.length) return null;

  return (
    <section className="blog-sec">
      <div className="blog-sec-head">
        <h2>编辑推荐</h2>
        <Link className="bs-more" href="/explore">
          更多推荐 →
        </Link>
      </div>
      <p className="blog-sec-sub">按热度和评价挑出的常青内容</p>
      {picks.isLoading ? (
        <div style={{ color: 'var(--ink-soft)', padding: '24px 0', textAlign: 'center' }}>
          加载中…
        </div>
      ) : items.length ? (
        items.map((w) => <FeedRow key={w.id} work={w} variant="rec" />)
      ) : (
        <Empty icon="⭐" title="暂无推荐" />
      )}
    </section>
  );
}
