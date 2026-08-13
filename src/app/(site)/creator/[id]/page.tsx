'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { useCreator, useCreatorWorks } from '@/hooks/useCreator';
import { useFollow } from '@/hooks/useSocial';
import { WorkCard } from '@/components/work/WorkCard';
import { Empty } from '@/components/common/Empty';
import { formatNum } from '@/lib/format';

const TABS = [
  { key: 'all', label: '全部作品' },
  { key: 'free', label: '免费' },
  { key: 'fine', label: '精品' },
  { key: 'hot', label: '最受欢迎' },
];

export default function CreatorPage() {
  const { id } = useParams<{ id: string }>();
  const { data: creator, isLoading } = useCreator(id);
  const [tab, setTab] = useState('all');
  const works = useCreatorWorks(id, tab);
  const follow = useFollow(id);

  if (isLoading) return <main className="page">加载中…</main>;
  if (!creator)
    return (
      <main className="page">
        <Empty
          icon="🕳️"
          title="没有找到这个创作者"
          action={
            <Link className="btn btn-primary" href="/">
              回到首页
            </Link>
          }
        />
      </main>
    );

  const followed = creator.myFollow ?? false;

  return (
    <main className="page">
      <div className="cr-hero-bar">
        <div className="avatar" style={{ background: creator.avatarColor }}>
          {creator.username[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {creator.username}
            {creator.verified ? <span className="dh-check">✓</span> : null}
          </h1>
          <div className="sub" style={{ color: 'var(--ink-soft)' }}>
            {creator.college} · {creator.direction}
          </div>
          {creator.honor ? (
            <div style={{ fontSize: 12.5, color: 'var(--fine)' }}>{creator.honor}</div>
          ) : null}
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6 }}>{creator.bio}</div>
        </div>
        <div className="h-acts">
          <button
            className={`btn ${followed ? 'btn-ghost' : 'btn-primary'}`}
            onClick={() => follow.mutate(!followed)}
          >
            {followed ? '✓ 已关注' : '+ 关注 TA'}
          </button>
        </div>
      </div>

      <div className="stat-grid" style={{ margin: '18px 0 22px' }}>
        <div className="stat-card">
          <div className="lb">已帮助</div>
          <div className="v">{formatNum(creator.helped)}</div>
        </div>
        <div className="stat-card">
          <div className="lb">粉丝</div>
          <div className="v">
            {creator.fans >= 1000 ? `${(creator.fans / 1000).toFixed(1)}k` : creator.fans}
          </div>
        </div>
        <div className="stat-card">
          <div className="lb">作品</div>
          <div className="v">{creator.works}</div>
        </div>
        <div className="stat-card">
          <div className="lb">好评</div>
          <div className="v">{creator.rate}</div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 18 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {works.data?.length ? (
        <div className="card-grid">
          {works.data.map((w) => (
            <WorkCard key={w.id} work={w} />
          ))}
        </div>
      ) : (
        <Empty icon="📚" title="暂无作品" desc="该创作者还没有发布作品" />
      )}
    </main>
  );
}
