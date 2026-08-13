'use client';

import Link from 'next/link';
import { useFollowingFeed } from '@/hooks/useCreator';
import { DynamicCard } from '@/components/creator/DynamicCard';
import { Empty } from '@/components/common/Empty';

export default function FollowingPage() {
  const { data: dynamics } = useFollowingFeed();

  return (
    <main className="page" style={{ maxWidth: 720 }}>
      <div className="page-head">
        <div>
          <h1>关注动态</h1>
          <div className="sub">你关注的创作者的最新作品与分享</div>
        </div>
      </div>
      {dynamics?.length ? (
        <div className="dyn-list">
          {dynamics.map((d) => (
            <DynamicCard key={d.id} dynamic={d} />
          ))}
        </div>
      ) : (
        <Empty
          icon="🔔"
          title="还没有关注任何创作者"
          desc="关注创作者后，TA 的新作品会出现在这里"
          action={
            <Link className="btn btn-primary" href="/">
              去发现优秀创作者
            </Link>
          }
        />
      )}
    </main>
  );
}
