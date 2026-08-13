'use client';

import { useState } from 'react';
import { WorkCard } from '@/components/work/WorkCard';
import { FineCard } from '@/components/work/FineCard';
import { Empty } from '@/components/common/Empty';
import { useWorks } from '@/hooks/useWorks';
import { useRank } from '@/hooks/useSearch';

const RANK_TABS = [
  { key: 'help', label: '助人榜' },
  { key: 'rate', label: '好评榜' },
  { key: 'fav', label: '收藏榜' },
  { key: 'creator', label: '创作者榜' },
];

export default function HomePage() {
  const [rankTab, setRankTab] = useState('help');
  const free = useWorks({ page: 1, pageSize: 8, sort: 'hot', isFree: true });
  const fine = useWorks({ page: 1, pageSize: 6, sort: 'complex', isFree: false });
  const rank = useRank(rankTab);

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>校园广场</h1>
          <div className="sub">分享知识 → 帮助同学 → 获得影响力 → 获得收益</div>
        </div>
      </div>

      <section style={{ marginBottom: 34 }}>
        <div className="page-head" style={{ marginBottom: 14 }}>
          <h1 style={{ fontSize: 18 }}>今日免费推荐</h1>
          <div className="sub">学长学姐分享的免费资料，不花一分钱也能学到真东西</div>
        </div>
        {free.data?.data.length ? (
          <div className="card-grid">
            {free.data.data.map((w) => (
              <WorkCard key={w.id} work={w} />
            ))}
          </div>
        ) : (
          <Empty icon="📚" title="暂无免费作品" desc="创作者正在路上，敬请期待" />
        )}
      </section>

      <section style={{ marginBottom: 34 }}>
        <div className="page-head" style={{ marginBottom: 14 }}>
          <h1 style={{ fontSize: 18 }}>精品专区</h1>
          <div className="sub">精心打磨的高质量内容，值得为知识付费</div>
        </div>
        {fine.data?.data.length ? (
          <div className="fine-grid">
            {fine.data.data.map((w) => (
              <FineCard key={w.id} work={w} />
            ))}
          </div>
        ) : (
          <Empty icon="💎" title="暂无精品" desc="精品内容即将上线" />
        )}
      </section>

      <section>
        <div className="page-head" style={{ marginBottom: 14 }}>
          <h1 style={{ fontSize: 18 }}>排行榜</h1>
          <div className="sub">以帮助同学为荣 · 非销量榜</div>
        </div>
        <div className="tabs" style={{ marginBottom: 16 }}>
          {RANK_TABS.map((t) => (
            <button
              key={t.key}
              className={`tab-btn ${rankTab === t.key ? 'active' : ''}`}
              onClick={() => setRankTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="card" style={{ padding: 6 }}>
          {rank.data?.length ? (
            rank.data.map((r, i) => {
              const e = r.creator ?? r.work;
              return (
                <div
                  key={i}
                  className="rank-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderBottom: i < rank.data.length - 1 ? '1px solid var(--line-2)' : 'none',
                  }}
                >
                  <div
                    className="rank-no"
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: i < 3 ? 'var(--pri-50)' : 'var(--bg-soft)',
                      color: 'var(--pri-600)',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div
                    className="rank-av"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: e.avatarColor ?? 'var(--bg-deep)',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#fff',
                      fontWeight: 700,
                    }}
                  >
                    {(e.username ?? e.title ?? '?')[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 14 }}>{e.username ?? e.title}</b>
                    {e.direction ? (
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{e.direction}</div>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{e.course}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <b style={{ fontSize: 14, color: 'var(--pri-600)' }}>{r.metric}</b>
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                      {rankTab === 'help'
                        ? '位同学受助'
                        : rankTab === 'fav'
                          ? '次收藏'
                          : rankTab === 'creator'
                            ? '位粉丝'
                            : '好评'}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <Empty icon="🏆" title="暂无排行数据" />
          )}
        </div>
      </section>
    </main>
  );
}
