'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useWork } from '@/hooks/useWork';
import { apiFetch } from '@/lib/api/client';
import { Stars } from '@/components/common/Stars';
import { RatingBars } from '@/components/work/RatingBars';
import { FineCard } from '@/components/work/FineCard';
import { Empty } from '@/components/common/Empty';
import { Icon } from '@/lib/icons';
import { formatNum } from '@/lib/format';
import { toast } from '@/stores/ui';
import type { WorkListItem } from '@/lib/types';

export default function WorkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: work, isLoading } = useWork(id);

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
          <button className="btn btn-light btn-sm" onClick={() => toast('收藏功能开发中')}>
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
            <div className="review-list">
              <Empty icon="✍️" title="还没有评价" desc="成为第一个评价的人吧" />
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
                <button
                  className="btn btn-mint btn-block btn-lg"
                  onClick={() => toast('下载功能开发中（F3 完成）')}
                >
                  {work.myAccess ? '再次下载' : '免费下载'}
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-block btn-lg"
                  onClick={() => toast('购买功能开发中（F3 完成）')}
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
    </main>
  );
}
