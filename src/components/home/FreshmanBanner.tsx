'use client';

import Link from 'next/link';
import { useWorks } from '@/hooks/useWorks';
import { PRESET_TAGS } from '@/lib/constants';
import { formatNum } from '@/lib/format';

const FLAG = process.env.NEXT_PUBLIC_FRESHMAN_ZONE !== 'off';

/** 新生专区横幅（V3-7，开学季运营位）：chips 跳转 explore CAMPUS 过滤。
 *  由父组件以 FRESHMAN_ZONE_ENABLED 条件渲染（flag off 时连数据请求都不发），
 *  开学季结束后 .env 设 NEXT_PUBLIC_FRESHMAN_ZONE=off 重启即整体下线。 */
export const FRESHMAN_ZONE_ENABLED = FLAG;

export function FreshmanBanner() {
  const hot = useWorks({ category: 'CAMPUS', sort: 'hot', pageSize: 2, isFree: true });
  const chips = PRESET_TAGS.CAMPUS.slice(0, 8);

  return (
    <section className="freshman-banner" aria-label="新生专区">
      <div className="fb-txt">
        <div className="fb-title">
          <span className="fb-ico">🎓</span>
          <div>
            <b>你好，2026 级新同学</b>
            <small>报到、选课、军训、宿舍——学长学姐把路都替你踩过了</small>
          </div>
        </div>
        <div className="fb-chips">
          {chips.map((t) => (
            <Link
              key={t}
              className="fb-chip"
              href={`/explore?cat=CAMPUS&tag=${encodeURIComponent(t)}`}
            >
              {t}
            </Link>
          ))}
          <Link className="fb-chip more" href="/explore?cat=CAMPUS">
            更多 →
          </Link>
        </div>
      </div>
      {hot.data?.data.length ? (
        <div className="fb-works">
          {hot.data.data.map((w) => (
            <Link key={w.id} className="fb-work" href={`/work/${w.id}`}>
              <span className="fbw-cover">{w.coverIcon}</span>
              <span className="fbw-txt">
                <b>{w.title}</b>
                <small>👁 {formatNum(Number(w.views))} 观看</small>
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
