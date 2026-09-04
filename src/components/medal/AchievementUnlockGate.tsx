'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/hooks/useAuth';
import { Medal, RARITY, type Rarity } from './Medal';
import type { PopAchievement } from '@/hooks/useAchievement';

const CONFETTI_COLORS = ['#ffd97a', '#35c4a5', '#ff7bb0', '#7db8f0', '#c04f92'];

/**
 * V8 解锁弹层（全局 Gate）：登录后延迟 2.5s 检查待弹成就（popped=false），
 * 全屏礼花动画展示「收下」后确认并取下一条（可连续弹多条）。
 * 延迟是为了错开登录公告弹窗（AnnounceGate）。
 */
export function AchievementUnlockGate() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [pop, setPop] = useState<PopAchievement | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) return;
    const t = setTimeout(async () => {
      try {
        const next = await apiFetch<PopAchievement | null>('/me/achievement-pop');
        setPop(next);
      } catch {
        /* 静默：不影响主站 */
      } finally {
        setChecked(true);
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [user?.id]);

  if (!pop || !user) return null;

  const rar = (pop.rarity as Rarity) in RARITY ? (pop.rarity as Rarity) : 'bronze';

  const take = async () => {
    try {
      const next = await apiFetch<PopAchievement | null>('/me/achievement-pop', {
        method: 'POST',
        body: JSON.stringify({ id: pop.id }),
      });
      qc.invalidateQueries({ queryKey: ['me', 'notifications'] });
      qc.invalidateQueries({ queryKey: ['me', 'achievements'] });
      setPop(next);
    } catch {
      setPop(null);
    }
  };

  return (
    <div className="unlock-overlay" role="dialog" aria-label="成就解锁">
      <div className="unlock-rays" />
      <div className="unlock-box">
        <span className="unlock-ring" />
        <span className="unlock-ring d2" />
        <span className="unlock-ring d3" />
        <div className="unlock-medal">
          <Medal symbol={pop.symbol} rarity={rar} size={150} />
        </div>
        <div className="unlock-confetti">
          {Array.from({ length: 14 }, (_, i) => (
            <i
              key={i}
              style={
                {
                  '--dx': `${Math.random() * 360 - 180}px`,
                  '--rot': `${Math.random() * 720 - 360}deg`,
                  background: CONFETTI_COLORS[i % 5],
                  left: `${(i - 7) * 14}px`,
                  animationDelay: `${Math.random() * 1.2}s`,
                  animationDuration: `${2 + Math.random() * 1.2}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <div className="unlock-kicker">ACHIEVEMENT UNLOCKED</div>
        <div className="unlock-title">{pop.title}</div>
        <div className="unlock-desc">{pop.description}</div>
        <div
          className="unlock-rare"
          style={{ borderColor: RARITY[rar].rim, color: RARITY[rar].rim }}
        >
          {RARITY[rar].label}
        </div>
        <button className="btn btn-primary btn-lg unlock-take" onClick={take}>
          收下勋章
        </button>
      </div>
    </div>
  );
}
