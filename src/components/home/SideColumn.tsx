'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, apiFetchPage } from '@/lib/api/client';
import { useRank } from '@/hooks/useSearch';
import { useCategoryCounts } from '@/hooks/useCategoryCounts';
import { CATEGORIES } from '@/lib/constants';
import { BadgeInline } from '@/components/medal/BadgeInline';
import { UserAvatar } from '@/components/common/UserAvatar';
import type { Announcement } from '@/lib/types';

const RANK_TABS = [
  { key: 'help', label: '助人榜' },
  { key: 'rate', label: '好评榜' },
  { key: 'fav', label: '收藏榜' },
  { key: 'creator', label: '创作者' },
  { key: 'checkin', label: '打卡' },
] as const;

const METRIC_LABEL: Record<string, string> = {
  help: '位同学受助',
  rate: '好评',
  fav: '次收藏',
  creator: '位粉丝',
  checkin: '天连续',
};

/** 侧栏：排行榜（4 tab） + 公告 + 分类目录。sticky 跟随滚动。 */
export function SideColumn() {
  return (
    <aside className="blog-side">
      <SideRank />
      <SideNotes />
      <SideCats />
    </aside>
  );
}

function SideRank() {
  const [tab, setTab] = useState<string>('help');
  const rank = useRank(tab);
  const items = rank.data?.slice(0, 5) ?? [];

  return (
    <div className="side-box">
      <h3>🏆 排行榜</h3>
      <div className="sb-sub">以帮助同学为荣 · 非销量榜</div>
      <div className="side-tabs">
        {RANK_TABS.map((t) => (
          <button
            key={t.key}
            className={`side-tab ${tab === t.key ? 'on' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {rank.isLoading ? (
        <div
          style={{ color: 'var(--ink-soft)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}
        >
          加载中…
        </div>
      ) : items.length ? (
        items.map((r: any, i: number) => {
          const e = r.creator ?? r.work ?? r.user; // checkin 榜行是 user（V12）
          const av = r.creator ?? r.work?.author ?? r.user ?? e;
          return (
            <Link key={i} href={`/user/${av.id}`} className="sr-row">
              <span className={`rank-no ${i < 3 ? `t${i + 1}` : ''}`}>{i + 1}</span>
              <UserAvatar id={av.id} user={av} size={32} radius={8} />
              <span className="sr-name">
                {e.username ?? e.title}
                <BadgeInline badge={av.badge ?? r.work?.author?.badge} size={18} />
                <small>
                  {tab === 'checkin'
                    ? r.user.dorm || r.user.college || ''
                    : e.direction || e.course || ''}
                </small>
              </span>
              <span className="sr-metric">
                <b>{r.metric}</b>
                <small>{METRIC_LABEL[tab]}</small>
              </span>
            </Link>
          );
        })
      ) : (
        <div
          style={{ color: 'var(--ink-soft)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}
        >
          暂无数据
        </div>
      )}
      {tab === 'checkin' ? (
        <Link href="/roadmaps/rank" className="side-more">
          查看完整打卡榜 →
        </Link>
      ) : null}
    </div>
  );
}

function SideNotes() {
  const notes = useQuery({
    queryKey: ['announcements', 'side'],
    queryFn: () => apiFetchPage<Announcement[]>('/announcements?page=1&pageSize=2'),
    staleTime: 60_000,
  });
  const items = notes.data?.data ?? [];
  if (!items.length) return null;

  return (
    <div className="side-box">
      <h3>📢 公告</h3>
      <div className="sb-sub">平台动态</div>
      {items.map((n) => (
        <Link key={n.id} className="note-row" href="/announcements">
          <span className="n-date">{new Date(n.publishedAt).toLocaleDateString('zh-CN')}</span>
          <div className="n-title">{n.title}</div>
        </Link>
      ))}
    </div>
  );
}

function SideCats() {
  const counts = useCategoryCounts();

  return (
    <div className="side-box sc-cats">
      <h3>🗂️ 资料分类</h3>
      <div className="sb-sub">点击进入目录</div>
      {CATEGORIES.map((c) => (
        <Link key={c.key} className="cat-row" href={`/explore?cat=${c.key}`}>
          <span>{c.icon}</span>
          {c.label}
          <span className="c-count">{counts.data?.[c.key] ?? ''}</span>
        </Link>
      ))}
    </div>
  );
}
