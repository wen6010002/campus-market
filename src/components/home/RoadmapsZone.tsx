'use client';

import Link from 'next/link';
import { useRoadmaps } from '@/hooks/useRoadmaps';
import { formatNum } from '@/lib/format';
import { Empty } from '@/components/common/Empty';

/**
 * 学习路线图区（V10.1 独立分区 tab）：只放路线图，不放资料。
 * 大目录行形态（区别于首页资料流），每条展示摘要与阶段/步数/收藏。
 * 数据沿用收藏排序；入口区头沿用旧「路线规划建议区」文案导流上传。
 */
export function RoadmapsZone() {
  const roadmaps = useRoadmaps({ page: 1, pageSize: 30, sort: 'favs' });
  const items = roadmaps.data?.data ?? [];

  return (
    <section className="blog-sec" style={{ marginBottom: 0 }}>
      <div className="blog-sec-head">
        <h2>🧭 学习路线图</h2>
        <Link className="bs-more" href="/roadmaps/upload">
          上传我的路线 →
        </Link>
      </div>
      <p className="blog-sec-sub">不知道从哪开始学？跟着路线走，每一步可打卡，进度用热力图沉淀</p>

      {roadmaps.isLoading ? (
        <div style={{ color: 'var(--ink-soft)', padding: '40px 0', textAlign: 'center' }}>
          加载中…
        </div>
      ) : items.length ? (
        items.map((r) => (
          <Link key={r.id} className="rz-row" href={`/roadmaps/${r.id}`}>
            <span className="rz-ico">{r.coverIcon}</span>
            <span style={{ minWidth: 0 }}>
              <span className="rz-eyebrow">
                {r.uploader?.role === 'ADMIN' ? '官方维护' : (r.uploader?.username ?? '同学分享')}
              </span>
              <div className="rz-title">{r.title}</div>
              {r.summary ? <div className="rz-desc">{r.summary}</div> : null}
              <div className="rz-meta">
                <span>🧭 {r.stepsCount} 步</span>
                <span>❤ {formatNum(r.favs)} 收藏</span>
              </div>
            </span>
            <span className="rz-go">查看路线 →</span>
          </Link>
        ))
      ) : (
        <Empty icon="🧭" title="暂无路线图" desc="上传第一份路线，带着大家学" />
      )}
    </section>
  );
}
