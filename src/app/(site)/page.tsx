'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DynamicCard } from '@/components/creator/DynamicCard';
import { useAuth } from '@/hooks/useAuth';
import { useFollowingFeed } from '@/hooks/useCreator';
import { Masthead } from '@/components/home/Masthead';
import { FreshmanZone, FRESHMAN_ZONE_ENABLED } from '@/components/home/FreshmanZone';
import { LatestFeed } from '@/components/home/LatestFeed';
import { EditorPicks } from '@/components/home/EditorPicks';
import { RoadmapsZone } from '@/components/home/RoadmapsZone';
import { SideColumn } from '@/components/home/SideColumn';

type Zone = 'campus' | 'roadmaps';

const ZONE_TABS: { key: Zone; icon: string; label: string; sub: string }[] = [
  { key: 'campus', icon: '🏫', label: '校园学习区', sub: '新生 · 课程 · 资料' },
  { key: 'roadmaps', icon: '🧭', label: '学习路线图区', sub: '跟着走，可打卡' },
];

/**
 * V10.1 资料博客主页：刊头 → 分类行 →（关注动态）→ 双区 tab → 主列 + 侧栏。
 * 双区：校园学习区（新生特辑/最新上架/编辑推荐）与学习路线图区（只放路线图）。
 * ?zone= 兼容：campus→校园区；growth（旧自我提升区外链）→路线图区；其余默认校园区。
 */
export default function HomePage() {
  const { user } = useAuth();
  const [zone, setZone] = useState<Zone>('campus');
  const feed = useFollowingFeed(!!user);
  const feedItems = feed.data?.slice(0, 5) ?? [];

  useEffect(() => {
    document.title = '课搭 · 深大校园资料博客';
    const z = new URLSearchParams(window.location.search).get('zone');
    if (z === 'campus') setZone('campus');
    else if (z === 'roadmaps' || z === 'growth') setZone('roadmaps');
  }, []);

  return (
    <main className="page">
      <Masthead />

      {/* 关注动态：登录用户的第一屏社区内容（保留 V4 行为，两区共用） */}
      {user && feedItems.length ? (
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
      ) : null}

      {/* 双区 tab：校园学习区 / 学习路线图区 */}
      <nav className="zt-bar" aria-label="专区切换">
        {ZONE_TABS.map((t) => (
          <button
            key={t.key}
            className={`zt-btn ${zone === t.key ? 'on' : ''}`}
            onClick={() => setZone(t.key)}
          >
            <span>{t.icon}</span>
            {t.label}
            <small>{t.sub}</small>
          </button>
        ))}
      </nav>

      <div className="blog-layout">
        <div className="blog-main">
          {zone === 'campus' ? (
            <>
              {/* 新生特辑（flag off 时整块不渲染不发请求） */}
              {FRESHMAN_ZONE_ENABLED ? <FreshmanZone /> : null}
              <LatestFeed />
              <EditorPicks />
            </>
          ) : (
            <RoadmapsZone />
          )}
        </div>
        <SideColumn />
      </div>
    </main>
  );
}
