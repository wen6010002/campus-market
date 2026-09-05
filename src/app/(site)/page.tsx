'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { WorkCard } from '@/components/work/WorkCard';
import { FineCard } from '@/components/work/FineCard';
import { DynamicCard } from '@/components/creator/DynamicCard';
import { Empty } from '@/components/common/Empty';
import { useWorks } from '@/hooks/useWorks';
import { useRank } from '@/hooks/useSearch';
import { BadgeInline } from '@/components/medal/BadgeInline';
import { useAuth } from '@/hooks/useAuth';
import { useFollowingFeed } from '@/hooks/useCreator';
import { FreshmanBanner, FRESHMAN_ZONE_ENABLED } from '@/components/home/FreshmanBanner';
import { HomeRoadmapBanner } from '@/components/home/HomeRoadmapBanner';
import { UserAvatar } from '@/components/common/UserAvatar';
import { CATEGORIES } from '@/lib/constants';

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
    sub: '校内同学整理的课程与成长资料，按需选择',
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

  const free = useWorks({
    page: 1,
    pageSize: 8,
    sort: 'complex',
    isFree: true,
    excludeCat: 'ABROAD',
  });
  const fine = useWorks({
    page: 1,
    pageSize: 12,
    sort: 'complex',
    isFree: false,
    excludeCat: 'ABROAD',
  });
  const rank = useRank(rankTab);
  const feed = useFollowingFeed(!!user);
  const feedItems = feed.data?.slice(0, 5) ?? [];

  return (
    <main className="page">
      {/* 专区导航 + 分类导航：同一 sticky 容器置顶（分类入口始终最快可达） */}
      <div className="top-sticky">
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

        {/* 分类导航：两个专区共用分类入口，移动端可横向滚动 */}
        <nav className="cat-quick" aria-label="分类浏览">
          <span className="cq-label">📚 分类</span>
          <Link className="cq-chip all" href="/explore">
            全部
          </Link>
          {CATEGORIES.map((c) => (
            <Link key={c.key} className="cq-chip" href={`/explore?cat=${c.key}`}>
              {c.icon} {c.label}
            </Link>
          ))}
          <Link className="cq-chip more" href="/explore">
            更多 →
          </Link>
        </nav>
      </div>

      {zone === 'campus' ? (
        <>
          {/* 新生专区横幅（V3-7）：分类导航之下、关注动态之上；flag off 时整体不渲染不发请求 */}
          {FRESHMAN_ZONE_ENABLED ? <FreshmanBanner /> : null}

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
                  // 头像：创作者榜取创作者本人；作品榜（收藏/好评）取该作品作者
                  const av = r.creator ?? (r.work as any)?.author ?? e;
                  return (
                    <Link
                      key={i}
                      href={`/user/${av.id}`}
                      className="rank-item"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        borderBottom: i < rank.data.length - 1 ? '1px solid var(--line-2)' : 'none',
                        color: 'inherit',
                        textDecoration: 'none',
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
                      <UserAvatar id={av.id} user={av} size={36} radius={8} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ fontSize: 14 }}>
                          {e.username ?? e.title}
                          <BadgeInline
                            badge={av.badge ?? (r.work as any)?.author?.badge}
                            size={20}
                          />
                        </b>
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
                    </Link>
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
              <b>内容筛选</b>
              <small>先看内容和评价，再决定是否购买</small>
            </div>
            <div className="gv-card">
              <span className="gv-ico">🎓</span>
              <b>校园创作者</b>
              <small>来自校内同学的课程与求职经验</small>
            </div>
            <div className="gv-card">
              <span className="gv-ico">♾️</span>
              <b>一次购买</b>
              <small>之后可在个人资料库查看</small>
            </div>
          </section>

          {/* 路线规划建议区（V4）：精品专区上方，无数据不渲染 */}
          <HomeRoadmapBanner />

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
