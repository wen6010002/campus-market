'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { useWorks } from '@/hooks/useWorks';
import { PRESET_TAGS } from '@/lib/constants';
import { formatNum } from '@/lib/format';
import type { WorkListItem } from '@/lib/types';

const FLAG = process.env.NEXT_PUBLIC_FRESHMAN_ZONE !== 'off';

/**
 * 新生特辑块（V10，替代 V3-7 的 FreshmanBanner 横幅）：
 * 浅橙特辑块 = 标题 + 场景 chips + 3 条序号精选行 + 底部入口。
 * 沿用 flag 语义：off 时父组件不渲染、连数据请求都不发。
 * 注意：tags 查询 queryKey/返回结构必须与 explore 页完全一致（原始数组）——
 * 历史上此处返回 Set 与 explore 的期望不一致，同 key 缓存投毒导致点击报错（V8 事故）。
 */
export const FRESHMAN_ZONE_ENABLED = FLAG;

export function FreshmanZone() {
  const hot = useWorks({ category: 'CAMPUS', sort: 'complex', pageSize: 3, isFree: true });
  const availQuery = useQuery({
    queryKey: ['works', 'tags', 'CAMPUS'],
    queryFn: () => apiFetch<{ name: string; count: number }[]>('/works/tags?category=CAMPUS'),
    staleTime: 60_000,
  });
  const chips = availQuery.data
    ? PRESET_TAGS.CAMPUS.filter(
        (t) => (availQuery.data!.find((r) => r.name === t)?.count ?? 0) > 0,
      ).slice(0, 6)
    : PRESET_TAGS.CAMPUS.slice(0, 6);
  const rows = hot.data?.data ?? [];
  if (!rows.length) return null;

  return (
    <section className="fresh-zone" aria-label="新生专区">
      <div className="fresh-head">
        <span className="fresh-ico">🎓</span>
        <div className="fresh-title">
          你好，2026 级新同学
          <small>报到、选课、军训、宿舍——学长学姐把路都替你踩过了</small>
        </div>
      </div>
      <div className="fresh-chips">
        {chips.map((t) => (
          <Link key={t} className="fchip" href={`/explore?cat=CAMPUS&tag=${encodeURIComponent(t)}`}>
            {t}
          </Link>
        ))}
      </div>
      <div className="fresh-rows">
        {rows.map((w, i) => (
          <Link key={w.id} className="f-row" href={`/work/${w.id}`}>
            <span className="f-no">{String(i + 1).padStart(2, '0')}</span>
            <span style={{ minWidth: 0 }}>
              <span className="f-eyebrow">新生引路{w.course ? ` · ${w.course}` : ''}</span>
              <div className="f-title">{w.title}</div>
              {w.description ? <div className="f-desc">{w.description}</div> : null}
              <div className="f-meta">
                <b>{w.author.username}</b>
                <span>👁 {formatNum(Number(w.views))}</span>
                <span>⬇ {formatNum(w.downloads)}</span>
              </div>
            </span>
            <span className="f-arrow">→</span>
          </Link>
        ))}
      </div>
      <Link className="fresh-foot" href="/explore?cat=CAMPUS">
        查看新生专区全部资料 →
      </Link>
    </section>
  );
}
