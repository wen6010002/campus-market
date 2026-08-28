'use client';

import { useRouter } from 'next/navigation';
import { timeAgo } from '@/lib/format';
import { UserAvatar } from '@/components/common/UserAvatar';
import type { Dynamic } from '@/lib/types';

const VERB: Record<string, string> = {
  PUBLISH: '发布了新作品',
  UPDATE: '更新了作品',
  CHECKIN: '分享了动态',
};

/** 动态卡（对应原型 .dyn-card） */
export function DynamicCard({ dynamic }: { dynamic: Dynamic }) {
  const router = useRouter();
  const c = dynamic.creator;
  const w = dynamic.work;

  return (
    <div className="dyn-card">
      <div className="dh-head">
        <div className="dh-av" onClick={() => router.push(`/user/${c.id}`)}>
          <UserAvatar id={c.id} user={c} size={34} radius={9} />
        </div>
        <div className="dh-info">
          <div className="dh-name" onClick={() => router.push(`/user/${c.id}`)}>
            {c.username}
            {c.verified ? <span className="dh-check">✓</span> : null}
          </div>
          <div className="dh-time">{timeAgo(dynamic.createdAt)}</div>
        </div>
      </div>
      <div className="dh-text">
        <b>{VERB[dynamic.type] ?? '发布动态'}</b>
      </div>
      {w ? (
        <div className="dh-work" onClick={() => router.push(`/work/${w.id}`)}>
          <div className={`dh-wcover ${w.coverTheme}`}>{w.coverIcon}</div>
          <div className="dh-winfo">
            <h5>{w.title}</h5>
            <div className="row">
              {w.isFree ? (
                <span className="badge-free">免费</span>
              ) : (
                <span className="badge-fine">💎 精品</span>
              )}
              <span className="dh-time" style={{ margin: 0 }}>
                {w.course}
              </span>
            </div>
          </div>
        </div>
      ) : null}
      {w ? (
        <div className="dh-foot">
          <div className="dh-act">👍 {w.likes}</div>
          <div className="dh-act">⭐ {w.favs}</div>
          <div className="dh-act">📥 {w.downloads}</div>
        </div>
      ) : null}
    </div>
  );
}
