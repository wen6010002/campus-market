'use client';

import { WorkCard } from '@/components/work/WorkCard';
import { FineCard } from '@/components/work/FineCard';
import { Empty } from '@/components/common/Empty';
import { useWorks } from '@/hooks/useWorks';

export default function HomePage() {
  const free = useWorks({ page: 1, pageSize: 8, sort: 'hot', isFree: true });
  const fine = useWorks({ page: 1, pageSize: 6, sort: 'complex', isFree: false });

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
    </main>
  );
}
