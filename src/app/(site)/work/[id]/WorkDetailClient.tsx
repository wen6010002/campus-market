'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useWork } from '@/hooks/useWork';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api/client';
import { Stars } from '@/components/common/Stars';
import { RatingBars } from '@/components/work/RatingBars';
import { FineCard } from '@/components/work/FineCard';
import { UserAvatar } from '@/components/common/UserAvatar';
import { PreviewModal } from '@/components/work/PreviewModal';
import { WorkPreviewInline } from '@/components/work/WorkPreviewInline';
import { ReviewItem } from '@/components/work/ReviewItem';
import { Empty } from '@/components/common/Empty';
import { OrderModal } from '@/components/form/OrderModal';
import { RatingModal } from '@/components/form/RatingModal';
import { ReportModal } from '@/components/form/ReportModal';
import { useDownload } from '@/hooks/useOrder';
import { backOrHome } from '@/lib/nav';
import { useLike } from '@/hooks/useSocial';
import { useRatings } from '@/hooks/useRatings';
import { useFavorite } from '@/hooks/useSocial';
import { Icon } from '@/lib/icons';
import { formatNum } from '@/lib/format';
import { FREE_MODE } from '@/lib/constants';
import { toast } from '@/stores/ui';
import type { WorkDetail, WorkListItem, DownloadResult } from '@/lib/types';

interface Props {
  id: string;
  /** 服务端预取的作品数据（可能为 null：未找到 / 预取失败） */
  initialWork: WorkDetail | null;
  /** 管理员身份：对待审核作品展示审核操作 */
  isAdmin?: boolean;
}

const FILE_TYPE_LABEL: Record<string, string> = {
  MD: 'Markdown 文档',
  PDF: 'PDF 文档',
  DOCX: 'Word 文档',
  ZIP: '压缩包',
};

export default function WorkDetailClient({ id, initialWork, isAdmin }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: work, isLoading } = useWork(id, initialWork);
  // V7 全站免费：付费开关关闭时按免费作品展示（原定价保留在库，恢复付费即还原）
  const free = !!work && (work.isFree || FREE_MODE);
  const { user, isLoading: authLoading } = useAuth();
  const [orderOpen, setOrderOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reviewSort, setReviewSort] = useState('new');
  const download = useDownload(id);
  const ratings = useRatings(id, reviewSort);
  const favorite = useFavorite(id);
  const like = useLike(id); // V8 点赞（含成就/通知链路）
  const [likeBurst, setLikeBurst] = useState(false);
  const [favBurst, setFavBurst] = useState(false);

  // 手机端：本页用底部操作条替代全站 tabbar，避免双层底栏；
  // 作品不存在时不隐藏（Empty 页没有操作条可替代，否则手机端失去底部导航）
  useEffect(() => {
    if (!work) return;
    document.body.classList.add('work-detail-page');
    return () => document.body.classList.remove('work-detail-page');
  }, [work]);

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

  // hook 数据在闭包内不保留早退收窄，用 const 捕获已判空的 work
  const wk = work;
  const isAuthor = user?.id === work.author.id;
  const publishedAt = work.publishedAt ?? work.updatedAt;
  const d = new Date(publishedAt);
  const dateLabel = Number.isNaN(d.getTime())
    ? ''
    : `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 收录`;

  function doDownload() {
    download.mutate(undefined, {
      onSuccess: (result) => {
        toast('下载已开始', 'ok');
        window.open(result.url, '_blank');
      },
    });
  }

  async function doShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast('链接已复制', 'ok');
    } catch {
      toast('链接已复制', 'ok');
    }
  }

  function doLike() {
    if (authLoading) return; // auth 未水合时忽略点击，避免把已登录用户误弹去登录页
    if (!user) return router.push('/login');
    if (!wk.myLiked) setLikeBurst(true);
    like.mutate(!wk.myLiked);
  }

  function doFav() {
    if (authLoading) return;
    if (!user) return router.push('/login');
    if (!wk.myFav) setFavBurst(true);
    favorite.mutate(!wk.myFav);
  }

  function openPreview() {
    if (authLoading) return; // auth 未水合时忽略点击，避免误判
    if (!user && !free) return router.push('/login');
    setPreviewOpen(true);
  }

  const previewable = work.fileType === 'PDF' || work.fileType === 'MD';
  const hasAccess = free || work.myAccess;

  return (
    <main className="page wd-page">
      <div className="page-head" style={{ marginBottom: 14 }}>
        <button
          className="btn btn-light btn-sm"
          onClick={() => backOrHome(router)}
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

      {/* 标题块（横贯）：标题 → 作者行 → 统计/徽章/标签 */}
      <header className="wd-hero">
        <h1 className="wd-title">{work.title}</h1>
        <div className="wd-byline">
          <Link className="wd-author" href={`/user/${work.author.id}`}>
            <UserAvatar id={work.author.id} user={work.author} size={28} radius={7} />
            <b>{work.author.username}</b>
            <span className="dh-check" title="校园认证创作者">
              <Icon name="check" width={8} />
            </span>
          </Link>
          <span className="wd-dot">·</span>
          <span>{work.author.college}</span>
          <span className="wd-dot">·</span>
          <span>{dateLabel}</span>
          <span className="wd-dot">·</span>
          <span className="wd-rating">
            <Stars value={Number(work.rating)} size="sm" />
            <b>{work.rating}</b>
            <em>（{work.ratingCount} 人评分）</em>
          </span>
        </div>
        <div className="wd-subline">
          {free ? (
            <span className="badge-free">{FREE_MODE && !work.isFree ? '限时免费' : '免费'}</span>
          ) : (
            <span className="badge-fine">💎 精品</span>
          )}
          <span className="wd-stats">
            <span>
              <Icon name="eye" width={13} /> {formatNum(Number(work.views))} 浏览
            </span>
            <span>
              <Icon name="dl" width={13} /> {work.downloads} 下载
            </span>
            <span>
              <Icon name="fav" width={13} /> {work.favs} 收藏
            </span>
          </span>
          {work.tags.length ? (
            <span className="wd-tags">
              {work.tags.map((t) => (
                <span key={t} className="chip gray">
                  #{t}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      </header>

      {/* 左主右辅 */}
      <div className="wd-body">
        <div className="wd-main">
          {/* 简介：V11 前详情页从未渲染 description */}
          <section className="wd-abstract">
            <h2 className="wd-sec">简 介</h2>
            <p className="wd-abstract-text">
              {work.description || '作者没有留下简介，可以直接翻预览了解内容。'}
            </p>
            <div className="wd-meta">
              <span>
                课程 <b>{work.course}</b>
              </span>
              <span>
                适用 <b>{work.applyMajor ?? '全专业'}</b> · <b>{work.applyGrade ?? '全年级'}</b>
              </span>
              {work.applyCrowd ? (
                <span>
                  适合 <b>{work.applyCrowd}</b>
                </span>
              ) : null}
            </div>
          </section>

          {/* 内嵌预览：进视口自动加载，前 30% + 展开全文 */}
          {previewable ? (
            <WorkPreviewInline
              workId={work.id}
              fileType={work.fileType}
              onBuy={() => setOrderOpen(true)}
              onFullscreen={openPreview}
            />
          ) : null}

          {/* 评价区 */}
          <div className="review-section">
            <h2 className="wd-sec">用户评价（{work.ratingCount}）</h2>
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
            <div className="wd-related">
              <h2 className="wd-sec">相关推荐</h2>
              <div className="hfeed" style={{ paddingTop: 4 }}>
                {related.data.map((w) => (
                  <FineCard key={w.id} work={w} />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* 右栏：文件卡 + 作者卡 */}
        <aside className="wd-side">
          <div className="wd-file-card">
            <div className="wd-fc-type">
              <span className="wd-fc-ico">
                <Icon name="file" width={22} />
              </span>
              <div>
                <b>{FILE_TYPE_LABEL[work.fileType] ?? work.fileType}</b>
                <small>{previewable ? '支持在线阅读' : '下载后查看'}</small>
              </div>
            </div>
            <div className="wd-fc-meta">
              <span>{(work.fileSize / 1024 / 1024).toFixed(1)} MB</span>
              {work.pages ? <span>{work.pages} 页</span> : null}
              <span>{FILE_TYPE_LABEL[work.fileType] ? '' : work.fileType}</span>
            </div>
            <div className="wd-fc-actions">
              {hasAccess ? (
                <button className="btn btn-primary btn-block btn-lg" onClick={doDownload}>
                  <Icon name="dl" width={16} /> 下载
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-block btn-lg"
                  onClick={() => setOrderOpen(true)}
                >
                  ¥{work.price} 立即购买
                </button>
              )}
              <div className="wd-fc-row2">
                <button className={`btn btn-light burst ${favBurst ? 'on' : ''}`} onClick={doFav}>
                  {work.myFav ? '♥ 已收藏' : '♡ 收藏'}
                </button>
                <button
                  className={`btn btn-light burst pink ${likeBurst ? 'on' : ''}`}
                  onClick={doLike}
                >
                  {work.myLiked ? '♥ 已赞' : '♡ 点赞'}
                  <span className="num-bump" style={{ marginLeft: 4 }}>
                    {work.likes}
                  </span>
                </button>
              </div>
              <div className="wd-fc-minor">
                <button onClick={doShare}>分享</button>
                <span>·</span>
                {!isAuthor ? (
                  <button onClick={() => setReportOpen(true)}>举报</button>
                ) : (
                  <span>我的作品</span>
                )}
              </div>
              <div className="wd-fc-trust">
                <Icon name="check" width={12} />
                校园认证创作者 · 已帮助 {formatNum(work.author.helped)} 位同学
              </div>
            </div>
          </div>

          {/* 作者信任卡 */}
          <div className="trust-card" onClick={() => router.push(`/user/${work.author.id}`)}>
            <div className="trust-top">
              <UserAvatar id={work.author.id} user={work.author} size={44} radius={10} />
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
                  router.push(`/user/${work.author.id}`);
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
        </aside>
      </div>

      {/* 手机端底部常驻操作条（≤680px 显示；全屏弹窗打开时隐藏） */}
      <div className="wd-actionbar" aria-label="快捷操作">
        <Link className="ab-btn" href="/" aria-label="回到首页">
          <Icon name="home" width={20} />
          <span>首页</span>
        </Link>
        {previewable ? (
          <button className="ab-btn" onClick={openPreview}>
            <span className="ab-play">▶</span>
            <span>预览</span>
          </button>
        ) : null}
        {hasAccess ? (
          <button className="ab-dl" onClick={doDownload}>
            <Icon name="dl" width={16} /> 下载
          </button>
        ) : (
          <button className="ab-dl" onClick={() => setOrderOpen(true)}>
            ¥{work.price} 购买
          </button>
        )}
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
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="WORK"
        targetId={work.id}
        targetLabel={work.title}
      />
      <PreviewModal
        open={previewOpen}
        workId={work.id}
        fileType={work.fileType}
        title={work.title}
        price={work.price}
        watermark={user?.username ?? '访客'}
        onBuy={() => {
          setPreviewOpen(false);
          setOrderOpen(true);
        }}
        onClose={() => setPreviewOpen(false)}
      />
    </main>
  );
}
