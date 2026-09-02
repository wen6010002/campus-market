'use client';

import Link from 'next/link';
import { useRoadmaps } from '@/hooks/useRoadmaps';
import { RoadmapCard } from '@/components/roadmap/RoadmapCard';

/**
 * 首页自我提升区「路线规划建议区」（V4）：
 * 精品专区上方的 mint/teal 渐变突出横幅，右侧横滑展示高收藏路线图卡片；
 * 无已上架路线图时整段不渲染（仿 FreshmanBanner）。
 */
export function HomeRoadmapBanner() {
  const top = useRoadmaps({ page: 1, pageSize: 4, sort: 'favs' });
  const items = top.data?.data ?? [];
  if (top.isLoading || !items.length) return null;

  return (
    <section className="rm-banner">
      <div className="rm-banner-main">
        <div className="rm-banner-intro">
          <span className="rm-banner-flag">🗺 路线规划建议区</span>
          <h2>不知道从哪开始学？</h2>
          <p>
            跟着详细的阶段化学习路线走：每一步都可勾选打卡，
            进度用热力图沉淀，路线末尾直接附上配套资料，照着学就行。
          </p>
          <Link className="btn btn-teal" href="/roadmaps">
            查看全部路线图 →
          </Link>
        </div>
        <div className="rm-banner-rail dyn-rail">
          {items.map((r) => (
            <RoadmapCard key={r.id} roadmap={r} compact />
          ))}
        </div>
      </div>
    </section>
  );
}
