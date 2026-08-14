'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { WorkCard } from '@/components/work/WorkCard';
import { FineCard } from '@/components/work/FineCard';
import { DynamicCard } from '@/components/creator/DynamicCard';
import { Empty } from '@/components/common/Empty';
import { useWorks } from '@/hooks/useWorks';
import { useRank } from '@/hooks/useSearch';
import { useAuth } from '@/hooks/useAuth';
import { useFollowingFeed } from '@/hooks/useCreator';

const RANK_TABS = [
  { key: 'help', label: '助人榜' },
  { key: 'rate', label: '好评榜' },
  { key: 'fav', label: '收藏榜' },
  { key: 'creator', label: '创作者榜' },
];

type Zone = 'campus' | 'growth';

const ZONES: { key: Zone; icon: string; title: string; sub: string; badge: React.ReactNode }[] = [
  {
    key: 'campus',
    icon: '🏫',
    title: '校园专区',
    sub: '免费 · 学长学姐的真诚分享，不花一分钱学到真东西',
    badge: <span className="badge-free">免费</span>,
  },
  {
    key: 'growth',
    icon: '🚀',
    title: '自我提升区',
    sub: '精心打磨的付费精品，为成长投资一次，永久受益',
    badge: <span className="badge-fine">💎 付费精品</span>,
  },
];

export default function HomePage() {
  const [zone, setZone] = useState<Zone>('campus');
  const [rankTab, setRankTab] = useState('help');
  const { user } = useAuth();

  // 支持 /?zone=growth 从顶栏直达
  useEffect(() => {
    const z = new URLSearchParams(window.location.search).get('zone');
    if (z === 'campus' || z === 'growth') setZone(z);
  }, []);

  const free = useWorks({ page: 1, pageSize: 8, sort: 'hot', isFree: true });
  const fine = useWorks({ page: 1, pageSize: 12, sort: 'complex', isFree: false });
  const rank = useRank(rankTab);
  const feed = useFollowingFeed(!!user);
  const feedItems = feed.data?.slice(0, 5) ?? [];

  return (
    <main className="page">
      {/* 专区切换导航 */}
      <nav className="zone-nav" aria-label="专区导航">
        {ZONES.map((z) => (
          <button
            key={z.key}
            className={`zone-entry ${z.key} ${zone === z.key ? 'active' : ''}`}
            onClick={() => setZone(z.key)}
          >
            <span className="ze-ico">{z.icon}</span>
            <span className="ze-txt">
              <b>{z.title}</b>
              <small>{z.sub}</small>
            </span>
            <span className="ze-badge">{z.badge}</span>
          </button>
        ))}
      </nav>

      {zone === 'campus' ? (
        <>
          {/* 关注动态：登录用户的第一屏社区内容 */}
          {user ? (
            feedItems.length ? (
              <section className="follow-strip">
                <div className="page-head" style={{ marginBottom: 12 }}>
                  <div>
                    <h1 style={{ fontSize: 18 }}>🔔 关注动态</h1>
                    <div className="sub">你关注的创作者，正在更新</div>
                  </div>
                  <Link className="right btn btn-light btn-sm" href="/following">
                    查看全部 →
                  </Link>
                </div>
                <div className="dyn-rail">
                  {feedItems.map((d) => (
                    <DynamicCard key={d.id} dynamic={d} />
                  ))}
                </div>
              </section>
            ) : (
              <section className="follow-strip">
                <div className="follow-empty">
                  <span className="fe-ico">🤝</span>
                  <div className="fe-txt">
                    <b>关注你喜欢的创作者</b>
                    <small>TA 的新作品和分享，会第一时间出现在这个位置</small>
                  </div>
                  <Link className="btn btn-light btn-sm" href="/search">
                    去发现优秀创作者 →
                  </Link>
                </div>
              </section>
            )
          ) : null}

          <section style={{ marginBottom: 34 }}>
            <div className="page-head" style={{ marginBottom: 14 }}>
              <div>
                <h1 style={{ fontSize: 18 }}>今日免费推荐</h1>
                <div className="sub">学长学姐分享的免费资料，不花一分钱也能学到真东西</div>
              </div>
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

          <section>
            <div className="page-head" style={{ marginBottom: 14 }}>
              <div>
                <h1 style={{ fontSize: 18 }}>排行榜</h1>
                <div className="sub">以帮助同学为荣 · 非销量榜</div>
              </div>
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
                          <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                            {e.direction}
                          </div>
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
        </>
      ) : (
        <>
          <section className="growth-value">
            <div className="gv-card">
              <span className="gv-ico">💎</span>
              <b>精挑细选</b>
              <small>每一份精品都经过平台审核与算法加权，拒绝水内容</small>
            </div>
            <div className="gv-card">
              <span className="gv-ico">🎓</span>
              <b>校园认证创作者</b>
              <small>实名认证的学长学姐，走过你正在走的路</small>
            </div>
            <div className="gv-card">
              <span className="gv-ico">♾️</span>
              <b>一次购买 · 永久下载</b>
              <small>购买即获得永久权限，可随时回看、评价、催更</small>
            </div>
          </section>

          <section>
            <div className="page-head" style={{ marginBottom: 14 }}>
              <div>
                <h1 style={{ fontSize: 18 }}>精品专区</h1>
                <div className="sub">精心打磨的高质量内容，值得为知识付费</div>
              </div>
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
        </>
      )}
    </main>
  );
}
