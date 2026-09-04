'use client';

import Link from 'next/link';
import { ROADMAP_CATEGORY_LABEL } from '@/lib/constants';
import type { RoadmapListItem } from '@/lib/types';

/** 路线图竖卡（列表页/首页横幅共用；compact 用于横幅精简版） */
export function RoadmapCard({ roadmap, compact = false }: { roadmap: RoadmapListItem; compact?: boolean }) {
  const official = roadmap.uploader.role === 'ADMIN';
  return (
    <Link href={`/roadmaps/${roadmap.id}`} className={`rm-card ${compact ? 'compact' : ''}`}>
      <div className="rm-card-top">
        <span className="rm-card-icon">{roadmap.coverIcon}</span>
        <div className="rm-card-badges">
          {official ? <span className="rm-official">官方</span> : null}
          <span className="rm-card-cat">{ROADMAP_CATEGORY_LABEL[roadmap.category] ?? roadmap.category}</span>
        </div>
      </div>
      <b className="rm-card-title">{roadmap.title}</b>
      {!compact && roadmap.summary ? <p className="rm-card-summary">{roadmap.summary}</p> : null}
      <div className="rm-card-stats">
        <span>🧭 {roadmap.stepsCount} 步</span>
        <span>♥ {roadmap.favs}</span>
        {roadmap.publishedAt ? (
          <span className="rm-card-time">{new Date(roadmap.publishedAt).toLocaleDateString('zh-CN')}</span>
        ) : null}
      </div>
    </Link>
  );
}
