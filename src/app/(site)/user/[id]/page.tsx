'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile, useUserWorks, useUserRatings, useUserFollows } from '@/hooks/useCreator';
import { useFollow } from '@/hooks/useSocial';
import { useIncomeSummary, useIncomeTransactions, usePayouts, useMyWorks } from '@/hooks/useIncome';
import { WorkCard } from '@/components/work/WorkCard';
import { Empty } from '@/components/common/Empty';
import { UserAvatar as Avatar } from '@/components/common/UserAvatar';
import { PinnedBadges } from '@/components/medal/PinnedBadges';
import { HonorWall } from '@/components/medal/HonorWall';
import { ReportModal } from '@/components/form/ReportModal';
import { WithdrawModal } from '@/components/form/WithdrawModal';
import { formatCny, formatNum, timeAgo } from '@/lib/format';
import type { WorkListItem, Order, Notification, FollowRow, RoadmapListItem } from '@/lib/types';
import { ROADMAP_CATEGORY_LABEL, FREE_MODE } from '@/lib/constants';

/** 资料库行（/me/library 返回，弱类型） */
type LibraryItem = {
  id: string;
  title: string;
  course: string;
  coverIcon: string;
  coverTheme: string;
  kind: string;
};

/** 订单行（/me/orders 返回，含 work 摘要） */
type OrderWithWork = Order & { work?: { title: string } };

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '审核中',
  PUBLISHED: '已上架',
  REJECTED: '已驳回',
  TAKEN_DOWN: '已下架',
};

export default function UserPage() {
  return (
    <Suspense fallback={<main className="page">加载中…</main>}>
      <UserContent />
    </Suspense>
  );
}

function UserContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const { user: me, isLoading: meLoading } = useAuth();
  const { data: profile, isLoading } = useUserProfile(id, me?.id);
  const [tab, setTab] = useState(() => sp.get('tab') ?? 'works');
  // URL ?tab= 变化时同步（深链/跳转）
  useEffect(() => {
    const t = sp.get('tab');
    if (t && t !== tab) setTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);
  const [reportOpen, setReportOpen] = useState(false);
  const follow = useFollow(id);

  if (isLoading || meLoading) return <main className="page">加载中…</main>;
  if (!profile)
    return (
      <main className="page">
        <Empty
          icon="🕳️"
          title="没有找到这位用户"
          action={
            <Link className="btn btn-primary" href="/">
              回到首页
            </Link>
          }
        />
      </main>
    );

  const isSelf = profile.isSelf;
  // FREE_MODE（付费封存）：收益 tab 一并隐藏——付费暂停期无收益入口，恢复付费自动回归
  const TABS = isSelf
    ? [
        { key: 'works', label: '作品' },
        { key: 'ratings', label: '评价' },
        { key: 'honor', label: '荣誉' },
        { key: 'following', label: '关注' },
        { key: 'followers', label: '粉丝' },
        { key: 'favs', label: '收藏' },
        { key: 'library', label: '资料库' },
        { key: 'orders', label: '订单' },
        ...(FREE_MODE ? [] : [{ key: 'income', label: '收益' }]),
        { key: 'notif', label: '通知' },
        { key: 'reports', label: '我的举报' },
      ]
    : [
        { key: 'works', label: '作品' },
        { key: 'ratings', label: '评价' },
        { key: 'honor', label: '荣誉' },
        { key: 'following', label: '关注' },
        { key: 'followers', label: '粉丝' },
      ];

  return (
    <main className="page">
      {/* Hero */}
      <div className="up-hero">
        <Avatar id={id} user={profile} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="up-name">
            {profile.username}
            {profile.verified ? <span className="dh-check">✓</span> : null}
          </h1>
          <div className="up-sub">
            {profile.college || '校园用户'}
            {profile.grade ? ` · ${profile.grade}` : ''}
            {profile.major ? ` · ${profile.major}` : ''}
          </div>
          {profile.direction ? <div className="up-direction">{profile.direction}</div> : null}
          {profile.honor ? <div className="up-honor">🏅 {profile.honor}</div> : null}
          {profile.bio ? <div className="up-bio">{profile.bio}</div> : null}
          {/* V8 佩戴勋章栏（≤5，公开） */}
          {profile.badges?.length ? <PinnedBadges badges={profile.badges} /> : null}
        </div>
        <div className="h-acts">
          {isSelf ? (
            <>
              <Link className="btn btn-primary" href="/upload">
                发布作品
              </Link>
              <Link className="btn btn-ghost" href="/settings">
                编辑资料
              </Link>
            </>
          ) : (
            <>
              <button
                className={`btn ${profile.myFollow ? 'btn-ghost' : 'btn-primary'}`}
                disabled={!me && false}
                onClick={() => {
                  if (!me) return router.push('/login');
                  follow.mutate(!profile.myFollow);
                }}
              >
                {profile.myFollow ? '✓ 已关注' : '+ 关注 TA'}
              </button>
              <button
                className="btn btn-light"
                style={{ color: 'var(--ink-soft)' }}
                onClick={() => setReportOpen(true)}
              >
                ··· 举报
              </button>
            </>
          )}
        </div>
      </div>

      {/* 数据条 */}
      <div className="stat-grid" style={{ margin: '16px 0 20px' }}>
        <div className="stat-card">
          <div className="lb">粉丝</div>
          <div className="v">{formatNum(profile.fans)}</div>
        </div>
        <div className="stat-card">
          <div className="lb">关注</div>
          <div className="v">{formatNum(profile.following)}</div>
        </div>
        <div className="stat-card">
          <div className="lb">作品</div>
          <div className="v">{formatNum(profile.works)}</div>
        </div>
        <div className="stat-card">
          <div className="lb">已帮助</div>
          <div className="v">{formatNum(profile.helped)}</div>
        </div>
        <div className="stat-card">
          <div className="lb">好评</div>
          <div className="v">{profile.rate}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs up-tabs" style={{ marginBottom: 18 }}>
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

      {tab === 'works' && <WorksTab id={id} isSelf={isSelf} />}
      {tab === 'ratings' && <RatingsTab id={id} />}
      {tab === 'following' && <FollowsTab id={id} type="following" />}
      {tab === 'followers' && <FollowsTab id={id} type="followers" />}
      {isSelf && tab === 'favs' && <FavsTab />}
      {tab === 'honor' && <HonorWall isSelf={isSelf} />}
      {isSelf && tab === 'library' && <LibraryTab />}
      {isSelf && tab === 'orders' && <OrdersTab />}
      {isSelf && tab === 'income' && <IncomeTab />}
      {isSelf && tab === 'notif' && <NotifTab />}
      {isSelf && tab === 'reports' && <MyReportsTab />}

      {!isSelf ? (
        <ReportModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="USER"
          targetId={id}
          targetLabel={profile.username}
        />
      ) : null}
    </main>
  );
}

/* ============ 作品 tab（本人含管理视图） ============ */
function WorksTab({ id, isSelf }: { id: string; isSelf: boolean }) {
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState<'grid' | 'data'>(isSelf ? 'grid' : 'grid');
  const works = useUserWorks(id, filter);
  // 本人管理数据（含未发布作品）
  const mine = useMyWorks();

  return (
    <div>
      <div className="up-toolbar">
        <div className="tabs" style={{ borderBottom: 'none', gap: 4 }}>
          {['all', 'free', 'fine', 'hot'].map((f) => (
            <button
              key={f}
              className={`tab-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? '全部' : f === 'free' ? '免费' : f === 'fine' ? '精品' : '最受欢迎'}
            </button>
          ))}
        </div>
        {isSelf ? (
          <div className="tabs" style={{ borderBottom: 'none', gap: 4, marginLeft: 'auto' }}>
            <button
              className={`tab-btn ${view === 'grid' ? 'active' : ''}`}
              onClick={() => setView('grid')}
            >
              展示
            </button>
            <button
              className={`tab-btn ${view === 'data' ? 'active' : ''}`}
              onClick={() => setView('data')}
            >
              数据分析
            </button>
          </div>
        ) : null}
      </div>

      {view === 'data' && isSelf ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>作品</th>
                <th>状态</th>
                <th>观看</th>
                <th>下载</th>
                <th>收藏</th>
                <th>评分</th>
                {!FREE_MODE ? <th>收益</th> : null}
              </tr>
            </thead>
            <tbody>
              {mine.data?.length ? (
                mine.data.map((w: any) => (
                  <tr key={w.id}>
                    <td>
                      <Link href={`/work/${w.id}`} style={{ fontWeight: 600 }}>
                        {w.title}
                      </Link>
                    </td>
                    <td>
                      <span className={`up-status ${w.status}`}>
                        {STATUS_LABEL[w.status] ?? w.status}
                      </span>
                      {w.status === 'REJECTED' && w.rejectedReason ? (
                        <small style={{ display: 'block', color: 'var(--ink-faint)' }}>
                          {w.rejectedReason}
                        </small>
                      ) : null}
                    </td>
                    <td>{w.views}</td>
                    <td>{w.downloads}</td>
                    <td>{w.favs}</td>
                    <td>{w.rating}</td>
                    {!FREE_MODE ? <td>{formatCny(w.earnings)}</td> : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={FREE_MODE ? 6 : 7}
                    style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}
                  >
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : works.data?.length ? (
        <div className="card-grid">
          {works.data.map((w) => (
            <WorkCard key={w.id} work={w} />
          ))}
        </div>
      ) : isSelf ? (
        <Empty
          icon="🚀"
          title="发布你的第一份资料"
          desc="把你的笔记、题解、经验整理出来，帮助学弟学妹"
          action={
            <Link className="btn btn-primary" href="/upload">
              → 去发布
            </Link>
          }
        />
      ) : (
        <Empty icon="📚" title="暂无作品" desc="TA 还没有发布作品" />
      )}
    </div>
  );
}

/* ============ 评价 tab ============ */
function RatingsTab({ id }: { id: string }) {
  const ratings = useUserRatings(id);
  return ratings.data?.length ? (
    <div className="card" style={{ padding: 18 }}>
      {ratings.data.map((r) => (
        <div key={r.id} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <b>{'⭐'.repeat(r.stars)}</b>
            <Link href={`/work/${r.work.id}`} style={{ fontSize: 13, fontWeight: 600 }}>
              {r.work.title}
            </Link>
            <span style={{ fontSize: 12, color: 'var(--ink-faint)', marginLeft: 'auto' }}>
              {timeAgo(r.createdAt)}
            </span>
          </div>
          <div style={{ fontSize: 13.5, marginTop: 2 }}>{r.text}</div>
        </div>
      ))}
    </div>
  ) : (
    <Empty icon="✍️" title="暂无评价" />
  );
}

/* ============ 关注/粉丝 tab ============ */
function FollowsTab({ id, type }: { id: string; type: 'following' | 'followers' }) {
  const follows = useUserFollows(id, type);
  return follows.data?.length ? (
    <div className="card" style={{ padding: 8 }}>
      {follows.data.map((u: FollowRow) => (
        <FollowRowCard key={u.id} row={u} />
      ))}
    </div>
  ) : (
    <Empty
      icon={type === 'following' ? '👀' : '👥'}
      title={type === 'following' ? '还没有关注任何人' : '还没有粉丝'}
    />
  );
}

function FollowRowCard({ row }: { row: FollowRow }) {
  const follow = useFollow(row.id);
  return (
    <div className="fr-row">
      <Link href={`/user/${row.id}`} className="fr-main">
        <Avatar id={row.id} user={row} size={44} radius={10} />
        <div style={{ minWidth: 0 }}>
          <b>
            {row.username}
            {row.verified ? <span className="dh-check">✓</span> : null}
          </b>
          <div className="fr-sub">
            {row.college || '校园用户'}
            {row.bio ? ` · ${row.bio.slice(0, 24)}` : ''}
          </div>
        </div>
      </Link>
      <div className="fr-side">
        <span className="fr-fans">{row.fans} 粉丝</span>
        {!row.isSelf ? (
          <button
            className={`btn btn-sm ${row.myFollow ? 'btn-ghost' : 'btn-outline'}`}
            onClick={() => follow.mutate(!row.myFollow)}
          >
            {row.myFollow ? '已关注' : '+ 关注'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ============ 收藏 tab（本人） ============ */
function FavsTab() {
  const qc = useQueryClient();
  const favs = useQuery({
    queryKey: ['me', 'favorites'],
    queryFn: () =>
      apiFetch<
        (WorkListItem & {
          pinned: boolean;
          downloaded: boolean;
          workStatus: string;
          deletedAt: string | null;
          category: string;
        })[]
      >('/me/favorites'),
  });
  // V4：收藏的路线图一并展示（分组）
  const roadmapFavs = useQuery({
    queryKey: ['me', 'roadmap-favorites'],
    queryFn: () => apiFetch<RoadmapListItem[]>('/me/roadmap-favorites'),
  });

  const togglePin = useMutation({
    mutationFn: (workId: string) => apiFetch(`/me/favorites/${workId}/pin`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'favorites'] }),
  });
  const unpin = useMutation({
    mutationFn: (workId: string) => apiFetch(`/me/favorites/${workId}/pin`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'favorites'] }),
  });

  const rmFavs = roadmapFavs.data ?? [];
  const workFavs = favs.data ?? [];
  const bothEmpty = !favs.isLoading && !roadmapFavs.isLoading && !rmFavs.length && !workFavs.length;

  if (bothEmpty)
    return <Empty icon="💝" title="暂无收藏" desc="遇到喜欢的资料或路线图点个收藏吧" />;
  return (
    <>
      {rmFavs.length ? (
        <div className="card" style={{ padding: 8, marginBottom: 14 }}>
          <div className="favs-sec-title">🗺 学习路线图</div>
          {rmFavs.map((r) => (
            <div key={r.id} className="fr-row">
              <Link href={`/roadmaps/${r.id}`} className="fr-main">
                <div
                  className="mini-cover g-default"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    display: 'grid',
                    placeItems: 'center',
                    flex: 'none',
                  }}
                >
                  {r.coverIcon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <b>{r.title}</b>
                  <div className="fr-sub">
                    {ROADMAP_CATEGORY_LABEL[r.category] ?? r.category} · {r.stepsCount} 步 · ♥{' '}
                    {r.favs}
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      ) : null}
      {workFavs.length ? (
        <div className="card" style={{ padding: 8 }}>
          {rmFavs.length ? <div className="favs-sec-title">📚 资料</div> : null}
          {workFavs.map((w) => {
            const offline = w.workStatus !== 'PUBLISHED' || !!w.deletedAt;
            return (
              <div key={w.id} className={`fr-row${offline ? ' is-offline' : ''}`}>
                <button
                  className={`fav-pin-btn${w.pinned ? ' pinned' : ''}`}
                  title={w.pinned ? '取消置顶' : '置顶到收藏栏顶部'}
                  onClick={() => (w.pinned ? unpin : togglePin).mutate(w.id)}
                >
                  {w.pinned ? '📌' : '☆'}
                </button>
                <Link href={`/work/${w.id}`} className="fr-main">
                  <div
                    className={`mini-cover ${w.coverTheme}`}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      display: 'grid',
                      placeItems: 'center',
                      flex: 'none',
                    }}
                  >
                    {w.coverIcon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <b>{w.title}</b>
                    <div className="fr-sub">
                      <span className="fav-cat">{w.course}</span>
                    </div>
                    <div className="fav-tags">
                      {offline ? <span className="fav-tag off">已下架</span> : null}
                      {!offline && w.downloaded ? (
                        <span className="fav-tag dl">已存本地</span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

/* ============ 资料库 tab（本人） ============ */
function LibraryTab() {
  const library = useQuery({
    queryKey: ['me', 'library'],
    queryFn: () => apiFetch<LibraryItem[]>('/me/library?filter=all'),
  });
  return library.data?.length ? (
    <div className="card" style={{ padding: 8 }}>
      {library.data.map((w: any) => (
        <div key={w.id} className="fr-row">
          <Link href={`/work/${w.id}`} className="fr-main">
            <div
              className={`mini-cover ${w.coverTheme}`}
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                display: 'grid',
                placeItems: 'center',
                flex: 'none',
              }}
            >
              {w.coverIcon}
            </div>
            <div style={{ minWidth: 0 }}>
              <b>{w.title}</b>
              <div className="fr-sub">
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
          </Link>
        </div>
      ))}
    </div>
  ) : (
    <Empty icon="📚" title="资料库是空的" desc="下载或购买过的资料都会保存在这里" />
  );
}

/* ============ 订单 tab（本人） ============ */
function OrdersTab() {
  const orders = useQuery({
    queryKey: ['me', 'orders'],
    queryFn: () => apiFetch<OrderWithWork[]>('/me/orders'),
  });
  return orders.data?.length ? (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>作品</th>
            <th>金额</th>
            <th>时间</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {orders.data.map((o) => (
            <tr key={o.id}>
              <td>
                <Link href={`/work/${o.workId}`}>{o.work?.title ?? o.workId}</Link>
              </td>
              <td>{formatCny(o.amount)}</td>
              <td>{timeAgo(o.createdAt)}</td>
              <td style={{ color: o.payStatus === 'PAID' ? 'var(--mint)' : 'var(--ink-soft)' }}>
                {o.payStatus === 'PAID'
                  ? '已支付'
                  : o.payStatus === 'REFUNDED'
                    ? '已退款'
                    : o.payStatus}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty icon="🧾" title="暂无订单" />
  );
}

/* ============ 收益 tab（本人） ============ */
function IncomeTab() {
  const [sub, setSub] = useState<'transactions' | 'withdraw'>('transactions');
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const { data: summary } = useIncomeSummary();
  const { data: transactions } = useIncomeTransactions();
  const { data: payouts } = usePayouts();

  return (
    <div>
      {FREE_MODE ? (
        <div
          className="hint"
          style={{
            fontSize: 12.5,
            color: 'var(--ink-soft)',
            background: 'var(--mint-50, #f0faf6)',
            padding: '10px 12px',
            borderRadius: 10,
            marginBottom: 14,
          }}
        >
          🎁 付费功能暂停中，当前全部资料免费开放；历史收益与提现不受影响
        </div>
      ) : null}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="lb">累计收益</div>
          <div className="v">{formatCny(summary?.total)}</div>
        </div>
        <div className="stat-card">
          <div className="lb">本月收益</div>
          <div className="v">{formatCny(summary?.month)}</div>
        </div>
        <div className="stat-card">
          <div className="lb">待结算</div>
          <div className="v">{formatCny(summary?.pending)}</div>
        </div>
        <div className="stat-card">
          <div className="lb">可提现</div>
          <div className="v">{formatCny(summary?.withdrawable)}</div>
          <button
            className="btn btn-primary btn-sm"
            style={{ marginTop: 8 }}
            onClick={() => setWithdrawOpen(true)}
          >
            提现
          </button>
        </div>
      </div>
      <div className="tabs" style={{ margin: '18px 0 14px' }}>
        <button
          className={`tab-btn ${sub === 'transactions' ? 'active' : ''}`}
          onClick={() => setSub('transactions')}
        >
          收益明细
        </button>
        <button
          className={`tab-btn ${sub === 'withdraw' ? 'active' : ''}`}
          onClick={() => setSub('withdraw')}
        >
          提现记录
        </button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
          {sub === 'transactions' ? (
            <>
              <thead>
                <tr>
                  <th>作品</th>
                  <th>购买者</th>
                  <th>金额</th>
                  <th>时间</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {transactions?.length ? (
                  transactions.map((t: any) => (
                    <tr key={t.id}>
                      <td>{t.workTitle}</td>
                      <td>{t.buyer}</td>
                      <td>{formatCny(t.amount)}</td>
                      <td>{timeAgo(t.createdAt)}</td>
                      <td>
                        {t.status === 'PENDING'
                          ? '待结算'
                          : t.status === 'SETTLED'
                            ? '已结算'
                            : '已提现'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}
                    >
                      暂无收益
                    </td>
                  </tr>
                )}
              </tbody>
            </>
          ) : (
            <>
              <thead>
                <tr>
                  <th>金额</th>
                  <th>方式</th>
                  <th>申请时间</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {payouts?.length ? (
                  payouts.map((p: any) => (
                    <tr key={p.id}>
                      <td>{formatCny(p.amount)}</td>
                      <td>{p.method}</td>
                      <td>{timeAgo(p.requestedAt)}</td>
                      <td>
                        {p.status === 'COMPLETED'
                          ? '已到账'
                          : p.status === 'REJECTED'
                            ? '已拒绝'
                            : '处理中'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}
                    >
                      暂无提现记录
                    </td>
                  </tr>
                )}
              </tbody>
            </>
          )}
        </table>
      </div>
      <WithdrawModal
        open={withdrawOpen}
        withdrawable={summary?.withdrawable ?? '0.00'}
        onClose={() => setWithdrawOpen(false)}
        onSuccess={() => setWithdrawOpen(false)}
      />
    </div>
  );
}

/* ============ 通知 tab（本人） ============ */
function NotifTab() {
  const qc = useQueryClient();
  const notifs = useQuery({
    queryKey: ['me', 'notifications'],
    queryFn: () => apiFetch<Notification[]>('/me/notifications'),
  });
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <b>通知中心</b>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={async () => {
            await apiFetch('/me/notifications/read-all', { method: 'POST' });
            qc.invalidateQueries({ queryKey: ['me', 'notifications'] });
            qc.invalidateQueries({ queryKey: ['me'] });
          }}
        >
          全部已读
        </button>
      </div>
      {notifs.data?.length ? (
        notifs.data.map((n) => (
          <div key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}>
            <div
              style={{ fontSize: 13.5, fontWeight: n.read ? 400 : 600 }}
              dangerouslySetInnerHTML={{ __html: n.text }}
            />
            <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{timeAgo(n.createdAt)}</div>
          </div>
        ))
      ) : (
        <div style={{ color: 'var(--ink-soft)' }}>暂无通知</div>
      )}
    </div>
  );
}

/* ============ 我的举报 tab（本人，V3-6） ============ */
function MyReportsTab() {
  const reports = useQuery({
    queryKey: ['me', 'reports'],
    queryFn: () =>
      apiFetch<
        {
          id: string;
          targetType: string;
          targetId: string;
          targetTitle: string | null;
          reason: string;
          detail: string | null;
          status: string;
          statusLabel: string;
          handleNote: string | null;
          createdAt: string;
        }[]
      >('/me/reports'),
  });
  return reports.data?.length ? (
    <div className="card" style={{ padding: 8 }}>
      {reports.data.map((r) => (
        <div key={r.id} className="fr-row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {r.targetType === 'WORK' ? (
                <Link href={`/work/${r.targetId}`} style={{ fontWeight: 600 }}>
                  {r.targetTitle ?? '已删除的作品'}
                </Link>
              ) : r.targetType === 'USER' ? (
                <Link href={`/user/${r.targetId}`} style={{ fontWeight: 600 }}>
                  用户：{r.targetTitle}
                </Link>
              ) : (
                <b style={{ fontWeight: 600 }}>{r.targetTitle}</b>
              )}
              <span className={`up-status ${r.status}`}>{r.statusLabel}</span>
            </div>
            <div className="fr-sub">
              原因 {r.reason}
              {r.detail ? ` · ${r.detail}` : ''} · {timeAgo(r.createdAt)}
            </div>
            {r.handleNote ? (
              <div className="fr-sub" style={{ color: 'var(--ink-2)' }}>
                处理备注：{r.handleNote}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  ) : (
    <Empty icon="📮" title="暂无举报记录" desc="遇到侵权、货不对板的内容可以点「··· 举报」" />
  );
}
