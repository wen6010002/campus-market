'use client';

import Link from 'next/link';
import { useWorks } from '@/hooks/useWorks';
import { FREE_MODE } from '@/lib/constants';
import { formatNum } from '@/lib/format';
import { FeedRow } from '@/components/work/FeedRow';
import { Empty } from '@/components/common/Empty';

/**
 * 最新上架（V10）：博客时间流。第一条放大为 hero（最新一篇值得更大版面），
 * 余下为标准目录行。分页导流 explore（主页是摘要页，不做无限滚动）。
 * 延续启动期约束：ABROAD 不进首页主流（侧栏分类入口可达）。
 */
export function LatestFeed() {
  const feed = useWorks({ page: 1, pageSize: 7, sort: 'new', excludeCat: 'ABROAD' });
  const items = feed.data?.data ?? [];
  const [hero, ...rest] = items;

  if (feed.isLoading) {
    return (
      <section className="blog-sec">
        <div className="blog-sec-head">
          <h2>最新上架</h2>
        </div>
        <div style={{ color: 'var(--ink-soft)', padding: '40px 0', textAlign: 'center' }}>
          加载中…
        </div>
      </section>
    );
  }
  if (!items.length) {
    return (
      <section className="blog-sec">
        <div className="blog-sec-head">
          <h2>最新上架</h2>
        </div>
        <Empty icon="📚" title="暂无资料" desc="创作者正在路上，敬请期待" />
      </section>
    );
  }

  const free = hero.isFree || FREE_MODE;
  const catLabel = hero.course ?? '';
  const d = new Date(hero.publishedAt ?? hero.updatedAt);

  return (
    <section className="blog-sec">
      <div className="blog-sec-head">
        <h2>最新上架</h2>
        <Link className="bs-more" href="/explore?sort=new">
          全部 →
        </Link>
      </div>
      <p className="blog-sec-sub">按收录时间倒序，每天更新</p>

      <article className="hero-post">
        <div className="hp-eyebrow">
          <span className="hp-new">最新</span>
          {catLabel || '资料'}
          {free ? (
            <span className="fr-pill free">{FREE_MODE && !hero.isFree ? '限时免费' : '免费'}</span>
          ) : (
            <span className="fr-pill fine">💎 精品位</span>
          )}
        </div>
        <Link href={`/work/${hero.id}`}>
          <h3>{hero.title}</h3>
        </Link>
        {hero.description ? <p className="hp-desc">{hero.description}</p> : null}
        <div className="hp-meta">
          <b>{hero.author.username}</b>
          {!Number.isNaN(d.getTime()) ? (
            <span>
              {String(d.getMonth() + 1).padStart(2, '0')}-{String(d.getDate()).padStart(2, '0')}{' '}
              收录
            </span>
          ) : null}
          <span>👁 {formatNum(Number(hero.views))}</span>
          <span>❤ {formatNum(hero.likes)}</span>
          <span>⬇ {formatNum(hero.downloads)}</span>
          {hero.tags.slice(0, 2).map((t) => (
            <span key={t} className="tag">
              #{t}
            </span>
          ))}
        </div>
      </article>

      {rest.map((w) => (
        <FeedRow key={w.id} work={w} variant="feed" />
      ))}

      <div className="feed-foot">
        <Link href="/explore?sort=new">浏览更早的资料 →</Link>
      </div>
    </section>
  );
}
