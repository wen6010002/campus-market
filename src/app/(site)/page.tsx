'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { DynamicCard } from '@/components/creator/DynamicCard';
import { useAuth } from '@/hooks/useAuth';
import { useFollowingFeed } from '@/hooks/useCreator';
import { Masthead } from '@/components/home/Masthead';
import { FreshmanZone, FRESHMAN_ZONE_ENABLED } from '@/components/home/FreshmanZone';
import { LatestFeed } from '@/components/home/LatestFeed';
import { EditorPicks } from '@/components/home/EditorPicks';
import { RoadmapStrip } from '@/components/home/RoadmapStrip';
import { SideColumn } from '@/components/home/SideColumn';

/**
 * V10 资料博客形态主页：刊头 → 分类行 →（关注动态）→ 主列(新生特辑/最新上架/编辑推荐/路线图) + 侧栏。
 * 专区切换(zone-nav)退役：V7 免费化后语义弱化，分类行直达；?zone= 参数保留解析以防旧外链 404。
 */
export default function HomePage() {
  const { user } = useAuth();
  const feed = useFollowingFeed(!!user);
  const feedItems = feed.data?.slice(0, 5) ?? [];

  useEffect(() => {
    document.title = '课搭 · 深大校园资料博客';
  }, []);

  return (
    <main className="page">
      <Masthead />

      {/* 关注动态：登录用户的第一屏社区内容（保留 V4 行为） */}
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

      <div className="blog-layout">
        <div className="blog-main">
          {/* 新生特辑（flag off 时整块不渲染不发请求） */}
          {FRESHMAN_ZONE_ENABLED ? <FreshmanZone /> : null}

          <LatestFeed />
          <EditorPicks />
          <RoadmapStrip />
        </div>
        <SideColumn />
      </div>
    </main>
  );
}
