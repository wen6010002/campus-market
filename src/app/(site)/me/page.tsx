'use client';

import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCny, timeAgo } from '@/lib/format';
import type { WorkListItem, Order, Rating, Notification } from '@/lib/types';

const TABS = [
  { key: 'library', label: '我的资料' },
  { key: 'favs', label: '我的收藏' },
  { key: 'orders', label: '我的订单' },
  { key: 'ratings', label: '我的评价' },
  { key: 'notif', label: '通知' },
];

export default function MePage() {
  return (
    <Suspense fallback={<main className="page">加载中…</main>}>
      <MeContent />
    </Suspense>
  );
}

function MeContent() {
  const { user } = useAuth();
  const sp = useSearchParams();
  const tab = sp.get('tab') ?? 'library';

  const library = useQuery({
    queryKey: ['me', 'library'],
    queryFn: () => apiFetch<any[]>('/me/library?filter=all'),
  });
  const favs = useQuery({
    queryKey: ['me', 'favorites'],
    queryFn: () => apiFetch<WorkListItem[]>('/me/favorites'),
  });
  const orders = useQuery({
    queryKey: ['me', 'orders'],
    queryFn: () => apiFetch<Order[]>('/me/orders'),
  });
  const ratings = useQuery({
    queryKey: ['me', 'ratings'],
    queryFn: () => apiFetch<Rating[]>('/me/ratings'),
  });
  const notifs = useQuery({
    queryKey: ['me', 'notifications'],
    queryFn: () => apiFetch<Notification[]>('/me/notifications'),
  });

  return (
    <main className="page" style={{ display: 'flex', gap: 22, alignItems: 'flex-start' }}>
      <aside className="card" style={{ width: 220, flexShrink: 0, padding: 16 }}>
        {user ? (
          <>
            <div
              className="avatar"
              style={{
                background: user.avatarColor,
                width: 48,
                height: 48,
                fontSize: 20,
                marginBottom: 10,
              }}
            >
              {user.username[0]}
            </div>
            <b style={{ fontSize: 15 }}>{user.username}</b>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 14 }}>
              {user.student ? `${user.student.college} · ${user.student.grade}` : '校园用户'}
            </div>
          </>
        ) : null}
        <div className="side-nav" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/me?tab=${t.key}`}
              className={`nav-link ${tab === t.key ? 'active' : ''}`}
              style={{ padding: '8px 10px', borderRadius: 6 }}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </aside>

      <div className="card" style={{ flex: 1, padding: 20, minHeight: 400 }}>
        {tab === 'library' && (
          <div>
            <h3 style={{ marginBottom: 14 }}>我的资料</h3>
            {library.data?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {library.data.map((w) => (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      className="dh-wcover"
                      style={{
                        width: 40,
                        height: 40,
                        background: 'var(--bg-deep)',
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 6,
                      }}
                    >
                      {w.coverIcon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/work/${w.id}`} style={{ fontWeight: 600 }}>
                        {w.title}
                      </Link>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                        {w.course} ·{' '}
                        {w.kind === 'bought'
                          ? '已购买'
                          : w.kind === 'download'
                            ? '已下载'
                            : w.kind === 'fav'
                              ? '已收藏'
                              : '已评价'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--ink-soft)' }}>暂无资料</div>
            )}
          </div>
        )}

        {tab === 'favs' && (
          <div>
            <h3 style={{ marginBottom: 14 }}>我的收藏</h3>
            {favs.data?.length ? (
              favs.data.map((w) => (
                <div
                  key={w.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}
                >
                  <div
                    className="dh-wcover"
                    style={{
                      width: 40,
                      height: 40,
                      background: 'var(--bg-deep)',
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 6,
                    }}
                  >
                    {w.coverIcon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/work/${w.id}`} style={{ fontWeight: 600 }}>
                      {w.title}
                    </Link>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{w.course}</div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--ink-soft)' }}>暂无收藏</div>
            )}
          </div>
        )}

        {tab === 'orders' && (
          <div>
            <h3 style={{ marginBottom: 14 }}>我的订单</h3>
            {orders.data?.length ? (
              orders.data.map((o) => (
                <div
                  key={o.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}
                >
                  <div style={{ flex: 1 }}>
                    <b>{o.workId}</b>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                      {timeAgo(o.createdAt)}
                    </div>
                  </div>
                  <div>{formatCny(o.amount)}</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: o.payStatus === 'PAID' ? 'var(--mint)' : 'var(--ink-soft)',
                    }}
                  >
                    {o.payStatus === 'PAID' ? '已支付' : o.payStatus}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--ink-soft)' }}>暂无订单</div>
            )}
          </div>
        )}

        {tab === 'ratings' && (
          <div>
            <h3 style={{ marginBottom: 14 }}>我的评价</h3>
            {ratings.data?.length ? (
              ratings.data.map((r) => (
                <div key={r.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <b>{'⭐'.repeat(r.stars)}</b>
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                      {timeAgo(r.createdAt)}
                    </span>
                  </div>
                  <div style={{ fontSize: 13 }}>{r.text}</div>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--ink-soft)' }}>暂无评价</div>
            )}
          </div>
        )}

        {tab === 'notif' && (
          <div>
            <h3 style={{ marginBottom: 14 }}>通知</h3>
            {notifs.data?.length ? (
              notifs.data.map((n) => (
                <div
                  key={n.id}
                  style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}
                >
                  <div style={{ fontSize: 13 }} dangerouslySetInnerHTML={{ __html: n.text }} />
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                    {timeAgo(n.createdAt)}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--ink-soft)' }}>暂无通知</div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
