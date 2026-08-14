'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useWork } from '@/hooks/useWork';
import { apiFetch } from '@/lib/api/client';
import { Stars } from '@/components/common/Stars';
import { RatingBars } from '@/components/work/RatingBars';
import { FineCard } from '@/components/work/FineCard';
import { ReviewItem } from '@/components/work/ReviewItem';
import { Empty } from '@/components/common/Empty';
import { OrderModal } from '@/components/form/OrderModal';
import { RatingModal } from '@/components/form/RatingModal';
import { useDownload } from '@/hooks/useOrder';
import { useRatings } from '@/hooks/useRatings';
import { useFavorite } from '@/hooks/useSocial';
import { Icon } from '@/lib/icons';
import { formatNum } from '@/lib/format';
import { toast } from '@/stores/ui';
import type { WorkDetail, WorkListItem, DownloadResult } from '@/lib/types';

interface Props {
  id: string;
  /** 服务端预取的作品数据（可能为 null：未找到 / 预取失败） */
  initialWork: WorkDetail | null;
  /** 管理员身份：对待审核作品展示审核操作 */
  isAdmin?: boolean;
}

export default function WorkDetailClient({ id, initialWork, isAdmin }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: work, isLoading } = useWork(id, initialWork);
  const [orderOpen, setOrderOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [reviewSort, setReviewSort] = useState('new');
  const download = useDownload(id);
  const ratings = useRatings(id, reviewSort);
  const favorite = useFavorite(id);

  const audit = useMutation({
    mutationFn: (action: 'APPROVE' | 'REJECT') =>
      apiFetch(`/admin/works/${id}/audit`, { method: 'POST', body: JSON.stringify({ action }) }),
    onSuccess: () => {
      toast('审核已处理', 'ok');
      qc.invalidateQueries({ queryKey: ['works', 'detail', id] });
    },
  });

  const reviewDownload = useMutation({
    mutationFn: () => apiFetch<DownloadResult>(`/admin/works/${id}/download`, { method: 'POST' }),
    onSuccess: (result) => {
      toast('已生成下载链接', 'ok');
      window.open(result.url, '_blank');
    },
  });

  const related = useQuery({
    queryKey: ['works', 'related', id],
    queryFn: () => apiFetch<WorkListItem[]>(`/works/${id}/related`),
    enabled: !!id,
  });

  if (isLoading) return <main className="page">加载中…</main>;
  if (!work)
    return (
      <main className="page">
        <Empty
          icon="🕳️"
          title="没有找到这个作品"
          desc="它可能已被作者下架"
          action={
            <Link className="btn btn-primary" href="/">
              回到首页
            </Link>
          }
        />
      </main>
    );

  const qb =
    work.quality === 'SELECTED' ? '🏅 平台精选' : work.quality === 'HIGH' ? '⭐ 高评分' : '';

  function doDownload() {
    download.mutate(undefined, {
      onSuccess: (result) => {
        toast('下载已开始', 'ok');
        window.open(result.url, '_blank');
      },
    });
  }

  return (
    <main className="page" style={{ paddingTop: 18 }}>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <button
          className="btn btn-light btn-sm"
          onClick={() => router.back()}
          style={{ marginRight: 4 }}
        >
          ← 返回
        </button>
        <div className="crumb">
          <Link href="/">首页</Link>
          <span className="sep">/</span>
          <Link href={`/search?q=${encodeURIComponent(work.course)}`}>{work.course}</Link>
          <span className="sep">/</span>
          <span className="cur">{work.title}</span>
        </div>
        <div className="right">
          <button className="btn btn-light btn-sm" onClick={() => toast('链接已复制', 'ok')}>
            分享
          </button>
          <button className="btn btn-light btn-sm" onClick={() => favorite.mutate(!work.myFav)}>
            {work.myFav ? '♥ 已收藏' : '♡ 收藏'}
          </button>
          <button
            className="btn btn-light btn-sm"
            style={{ color: 'var(--ink-soft)' }}
            onClick={() => toast('举报功能开发中')}
          >
            ··· 举报
          </button>
        </div>
      </div>

      {isAdmin && work.status !== 'PUBLISHED' ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            padding: '12px 16px',
            marginBottom: 16,
            borderRadius: 12,
            background: '#fff7e6',
            border: '1px solid #ffd591',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: '#ad6800' }}>
            🛡️ 审核模式 · 状态 {work.status}
          </span>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>（仅管理员可见）</span>
          <span style={{ flex: 1 }} />
          <button
            className="btn btn-outline btn-sm"
            disabled={reviewDownload.isPending}
            onClick={() => reviewDownload.mutate()}
          >
            {reviewDownload.isPending ? '生成中…' : '📥 下载审核'}
          </button>
          <button
            className="btn btn-mint btn-sm"
            disabled={audit.isPending}
            onClick={() => audit.mutate('APPROVE')}
          >
            {audit.isPending ? '处理中…' : '通过并上架'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={audit.isPending}
            onClick={() => audit.mutate('REJECT')}
          >
            驳回
          </button>
        </div>
      ) : null}

      <div className="wd">
        {/* 左栏 */}
        <div className="wd-left">
          <div className="wd-cover">
            <div className={`cover-top ${work.coverTheme}`}>
              <div className="badges">
                {work.isFree ? (
                  <span className="badge-free">免费</span>
                ) : (
                  <span className="badge-fine">💎 精品</span>
                )}
                {qb ? (
                  <span className="qb" style={{ background: 'rgba(255,255,255,.92)' }}>
                    {qb}
                  </span>
                ) : null}
              </div>
              <div className="glyph">{work.coverIcon}</div>
              <div className="watermark">{work.course}</div>
            </div>
            <div className="cover-meta">
              <span>
                <Icon name="file" width={13} />
                {work.fileType}
              </span>
              <span>{(work.fileSize / 1024 / 1024).toFixed(1)} MB</span>
              {work.pages ? <span>📄 {work.pages} 页</span> : null}
              <span>
                <Icon name="dl" width={13} />
                {work.downloads} 次下载
              </span>
              <span>
                <Icon name="fav" width={13} />
                {work.favs} 收藏
              </span>
            </div>
          </div>

          {/* 预览 */}
          <div className="preview-box">
            <div className="preview-head">
              <h3>资料预览</h3>
              <span className="lock">
                {work.previewOnly ? '🔒 完整版需购买 · 先了解再决定' : ''}
              </span>
            </div>
            <div className="preview-toc">
              <div className="toc-h">目录（共 {work.previewToc.length} 章）</div>
              {work.previewToc.map((t, i) => (
                <div key={i} className="toc-i">
                  <span>{t}</span>
                  <span className="lk">{work.previewOnly && i >= 2 ? '预览' : '可读'}</span>
                </div>
              ))}
              {work.previewOnly ? (
                <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => toast('购买后解锁完整版', 'warn')}
                  >
                    购买后解锁完整版
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {/* 评价区 */}
          <div className="review-section">
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              用户评价（{work.ratingCount}）
            </h3>
            <div className="review-summary">
              <div className="review-big">
                <div className="v">{work.rating}</div>
                <Stars value={Number(work.rating)} />
                <div className="lb">{work.ratingCount} 人评分</div>
              </div>
              <RatingBars dist={work.ratingDist} total={work.ratingCount} />
            </div>
            {work.myAccess && !work.myRating ? (
              <div style={{ margin: '6px 0 14px' }}>
                <button className="btn btn-primary btn-sm" onClick={() => setRatingOpen(true)}>
                  ⭐ 写一个评价
                </button>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)', marginLeft: 10 }}>
                  只有下载/购买过的同学才能评价，确保评分真实可信。
                </span>
              </div>
            ) : work.myRating ? (
              <div style={{ margin: '6px 0 14px', fontSize: 12.5, color: 'var(--ink-soft)' }}>
                你已评价 <b style={{ color: 'var(--pri-600)' }}>{work.myRating.stars} 分</b> ·
                感谢反馈
              </div>
            ) : null}
            <div className="tabs" style={{ marginBottom: 6 }}>
              {(['new', 'helpful', 'high', 'low'] as const).map((s) => (
                <button
                  key={s}
                  className={`tab-btn ${reviewSort === s ? 'active' : ''}`}
                  onClick={() => setReviewSort(s)}
                >
                  {s === 'new'
                    ? '最新'
                    : s === 'helpful'
                      ? '最有帮助'
                      : s === 'high'
                        ? '评分最高'
                        : '评分最低'}
                </button>
              ))}
            </div>
            <div className="review-list">
              {ratings.data?.length ? (
                ratings.data.map((r) => <ReviewItem key={r.id} rating={r} />)
              ) : (
                <Empty icon="✍️" title="还没有评价" desc="成为第一个评价的人吧" />
              )}
            </div>
          </div>

          {/* 相关推荐 */}
          {related.data?.length ? (
            <div className="preview-box" style={{ padding: 18 }}>
              <div
                className="preview-head"
                style={{ padding: '0 0 12px', borderBottom: '1px solid var(--line-2)' }}
              >
                <h3>相关推荐</h3>
              </div>
              <div className="hfeed" style={{ paddingTop: 14 }}>
                {related.data.map((w) => (
                  <FineCard key={w.id} work={w} />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* 右栏 */}
        <div className="wd-right">
          <div className="info-card">
            <h1>{work.title}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {work.isFree ? (
                <span className="badge-free">免费作品</span>
              ) : (
                <span className="badge-fine">💎 精品作品</span>
              )}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12.5,
                  color: 'var(--ink-soft)',
                }}
              >
                <Stars value={Number(work.rating)} size="sm" />
                <b style={{ color: 'var(--ink)', fontWeight: 700 }}>{work.rating}</b> ·{' '}
                {work.ratingCount} 人评分
              </span>
            </div>
            <div className="info-row">
              <span className="lb">热度</span>
              <span className="v">
                {work.downloads} 下载 · {work.favs} 收藏 · {formatNum(work.views)} 浏览
              </span>
            </div>
            <div className="info-row">
              <span className="lb">课程</span>
              <span className="v">{work.course}</span>
            </div>
            <div className="info-row">
              <span className="lb">适用</span>
              <span className="v">
                {work.applyMajor ?? '全专业'} · {work.applyGrade ?? '全年级'}
              </span>
            </div>
            {work.applyCrowd ? (
              <div className="info-row">
                <span className="lb">适合</span>
                <span className="v">{work.applyCrowd}</span>
              </div>
            ) : null}
            <div className="info-row">
              <span className="lb">标签</span>
              <span className="v">
                <span className="chips">
                  {work.tags.map((t) => (
                    <span key={t} className="chip gray">
                      {t}
                    </span>
                  ))}
                </span>
              </span>
            </div>
            <div className="info-actions">
              {work.isFree ? (
                <button className="btn btn-mint btn-block btn-lg" onClick={doDownload}>
                  {work.myAccess ? '再次下载' : '免费下载'}
                </button>
              ) : work.myAccess ? (
                <button className="btn btn-primary btn-block btn-lg" onClick={doDownload}>
                  下载作品
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-block btn-lg"
                  onClick={() => setOrderOpen(true)}
                >
                  ¥{work.price} 立即购买
                </button>
              )}
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center' }}>
                {work.isFree ? '下载后可再次下载并评价' : '购买后获得永久下载权限，可随时评价'}
              </div>
            </div>
            <div className="info-trust">
              <Icon name="check" width={12} />
              校园认证创作者 · 评分 {work.rating} · 已帮助 {formatNum(work.author.helped)} 位同学
            </div>
          </div>

          {/* 作者信任卡 */}
          <div className="trust-card" onClick={() => router.push(`/creator/${work.author.id}`)}>
            <div className="trust-top">
              <div className="avatar" style={{ background: work.author.avatarColor }}>
                {work.author.username[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="trust-name">
                  {work.author.username}{' '}
                  <span className="dh-check">
                    <Icon name="check" width={8} />
                  </span>
                </div>
                <div className="trust-desc">
                  {work.author.college} · {work.author.direction}
                </div>
                {work.author.honor ? <div className="trust-honor">{work.author.honor}</div> : null}
              </div>
              <button
                className="btn btn-light btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/creator/${work.author.id}`);
                }}
              >
                主页 →
              </button>
            </div>
            <div className="trust-stats">
              <div className="ts">
                <b>{formatNum(work.author.helped)}</b>
                <span>已帮助</span>
              </div>
              <div className="ts">
                <b>
                  {work.author.fans >= 1000
                    ? `${(work.author.fans / 1000).toFixed(1)}k`
                    : work.author.fans}
                </b>
                <span>粉丝</span>
              </div>
              <div className="ts">
                <b>{work.author.works}</b>
                <span>作品</span>
              </div>
              <div className="ts">
                <b>{work.author.rate}</b>
                <span>好评</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <OrderModal
        open={orderOpen}
        work={work}
        onClose={() => setOrderOpen(false)}
        onSuccess={() => {
          setOrderOpen(false);
          qc.invalidateQueries({ queryKey: ['works', 'detail', id] });
        }}
      />
      <RatingModal
        open={ratingOpen}
        workId={work.id}
        workTitle={work.title}
        onClose={() => setRatingOpen(false)}
        onSuccess={() => setRatingOpen(false)}
      />
    </main>
  );
}
