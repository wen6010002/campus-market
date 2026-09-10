'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { useRank } from '@/hooks/useSearch';
import { useAuth } from '@/hooks/useAuth';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Empty } from '@/components/common/Empty';

type CheckinRow = {
  rank: number;
  user: {
    id: string;
    username: string;
    avatarColor: string;
    hasAvatar?: boolean;
    avatarVer?: number;
    dorm: string | null;
    college: string;
  };
  metric: number;
};

type MyStats = { today: boolean; streakDays: number; totalDays: number };

/** 副标题：学院归属（宿舍楼展示暂缓上线，后端字段已就绪） */
function subLabel(u: CheckinRow['user']) {
  return u.college || '深大同学';
}

export default function CheckinRankPage() {
  const { user, isLoading: authLoading } = useAuth();
  const rank = useRank('checkin');
  const stats = useQuery({
    queryKey: ['me', 'checkin-stats'],
    queryFn: () => apiFetch<MyStats>('/me/checkin-stats'),
    enabled: !!user,
  });

  const rows: CheckinRow[] = rank.data ?? [];
  const mine = user ? rows.find((r) => r.user.id === user.id) : undefined;
  const last = rows[rows.length - 1];
  const gap = !mine && last && stats.data ? last.metric - stats.data.streakDays : 0;

  return (
    <main className="page" style={{ maxWidth: 760 }}>
      <div className="page-head">
        <div>
          <h1>🔥 连续打卡榜</h1>
          <div className="sub">学任意路线图的任意步骤都算当日打卡 · 断一天清零 · 前 30 名</div>
        </div>
        <Link className="btn btn-light" href="/roadmaps">
          ← 全部路线图
        </Link>
      </div>

      {/* 我的打卡卡 */}
      {!authLoading && user ? (
        stats.data ? (
          <div className="ck-mine card">
            <div className="ck-mine-left">
              <span className={`ck-mine-rank ${mine ? 'on' : ''}`}>
                {mine ? `第 ${mine.rank} 名` : '未上榜'}
              </span>
              <span className="ck-mine-streak">
                连续 <b>{stats.data.streakDays}</b> 天 · 累计 {stats.data.totalDays} 天
                {stats.data.today ? ' · 今天已打卡' : ' · 今天还没打卡'}
              </span>
            </div>
            {!mine ? (
              gap > 0 ? (
                <span className="ck-mine-gap">再连续 {gap + 1} 天可上榜</span>
              ) : (
                <Link className="btn btn-primary btn-sm" href="/roadmaps">
                  去打卡上榜
                </Link>
              )
            ) : null}
          </div>
        ) : null
      ) : (
        <div className="ck-mine card">
          <span className="ck-mine-streak">登录后可打卡上榜</span>
          <Link className="btn btn-primary btn-sm" href="/login?from=/roadmaps/rank">
            去登录
          </Link>
        </div>
      )}

      {rank.isLoading ? (
        <div className="card">加载中…</div>
      ) : rows.length ? (
        <>
          {/* 前三名领奖台 */}
          <div className="ck-podium">
            {rows.slice(0, 3).map((r) => (
              <Link key={r.user.id} href={`/user/${r.user.id}`} className={`ck-pd ck-pd-${r.rank}`}>
                <span className={`rank-no t${r.rank}`}>{r.rank}</span>
                <UserAvatar
                  id={r.user.id}
                  user={r.user}
                  size={r.rank === 1 ? 52 : 44}
                  radius={12}
                />
                <b>{r.user.username}</b>
                <small>{subLabel(r.user)}</small>
                <em>
                  {r.metric} <span>天</span>
                </em>
              </Link>
            ))}
          </div>

          {/* 4..30 名列表 */}
          {rows.length > 3 ? (
            <div className="card" style={{ padding: '6px 16px' }}>
              {rows.slice(3).map((r) => (
                <Link key={r.user.id} href={`/user/${r.user.id}`} className="ck-row">
                  <span className="rank-no">{r.rank}</span>
                  <UserAvatar id={r.user.id} user={r.user} size={32} radius={8} />
                  <span className="ck-name">
                    {r.user.username}
                    <small>{subLabel(r.user)}</small>
                  </span>
                  <span className="ck-days">
                    <b>{r.metric}</b>
                    <small>天连续</small>
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <Empty
          icon="🔥"
          title="还没有人上榜"
          desc="去任意路线图勾一个步骤，明天你就是第一名"
          action={
            <Link className="btn btn-primary" href="/roadmaps">
              去打卡
            </Link>
          }
        />
      )}
    </main>
  );
}
