'use client';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/stores/ui';
import { Medal, RARITY, type Rarity } from './Medal';
import { THRESHOLD_LADDER } from '@/lib/achievements';
import {
  useMyHonor,
  usePinAchievement,
  useFeaturedAchievement,
  type HonorItem,
} from '@/hooks/useAchievement';

/** 数量轴 key 前缀 → 进度指标（灰格「已帮助 87 / 100」） */
const METRIC_BY_PREFIX: Record<string, keyof typeof THRESHOLD_LADDER> = {
  HELP: 'helped',
  LIKES: 'likes',
  FAVS: 'favs',
  FIRST_WORK: 'works',
  WORKS: 'works',
};
const AXIS_LABELS: Record<string, string> = {
  HELP: '帮助之光的六阶成长',
  LIKES: '掌声三重奏',
  FAVS: '被珍藏',
  WORK: '作品耕耘',
  SPECIAL: '荣誉与限时',
};

function axisOf(key: string): string {
  if (key.startsWith('HELP')) return 'HELP';
  if (key.startsWith('LIKES')) return 'LIKES';
  if (key.startsWith('FAVS')) return 'FAVS';
  if (key.startsWith('WORK') || key === 'FIRST_WORK') return 'WORK';
  return 'SPECIAL';
}

function thresholdOf(key: string): number | null {
  for (const [metric, ladder] of Object.entries(THRESHOLD_LADDER)) {
    const hit = (ladder as readonly { key: string; n: number }[]).find((s) => s.key === key);
    if (hit) {
      void metric;
      return hit.n;
    }
  }
  return null;
}

/** 荣誉墙：已解锁（亮，含佩戴开关）→ 过期（半亮角标）→ 未解锁（灰+进度） */
export function HonorWall({ isSelf }: { isSelf: boolean }) {
  const qc = useQueryClient();
  const honor = useMyHonor(isSelf);
  const pin = usePinAchievement();
  const feat = useFeaturedAchievement();

  if (honor.isLoading)
    return (
      <div className="hint" style={{ padding: 30 }}>
        加载中…
      </div>
    );
  if (!honor.data) return null;
  const { items, pinnedCount, progresses } = honor.data;

  const groups = new Map<string, HonorItem[]>();
  for (const it of items) {
    const ax = axisOf(it.key);
    if (!groups.has(ax)) groups.set(ax, []);
    groups.get(ax)!.push(it);
  }

  const toggleFeat = (it: HonorItem) => {
    feat.mutate(
      { key: it.key, on: !it.featured },
      {
        onSuccess: () =>
          toast(it.featured ? '已取消展示成就' : `「${it.title}」已设为展示成就`, 'ok'),
        onError: (e: any) => toast(e?.message ?? '操作失败', 'warn'),
      },
    );
  };

  const togglePin = (it: HonorItem) => {
    pin.mutate(
      { key: it.key, on: !it.pinned },
      {
        onSuccess: () => {
          toast(it.pinned ? `已卸下「${it.title}」` : `已佩戴「${it.title}」`, 'ok');
          qc.invalidateQueries({ queryKey: ['users', 'detail'] });
        },
        onError: (e: any) => toast(e?.message ?? '操作失败', 'warn'),
      },
    );
  };

  return (
    <div className="honor">
      {isSelf ? (
        <div className="honor-tip">
          🎖 已解锁的勋章可点亮「佩戴」展示在主页（{pinnedCount}
          /5）；限时勋章到期自动收起，榜单再登顶可续期
        </div>
      ) : null}
      {[...groups.entries()].map(([ax, list]) => (
        <div key={ax} className="honor-axis">
          <div className="honor-axis-title">{AXIS_LABELS[ax] ?? '成就'}</div>
          <div className="honor-grid">
            {list.map((it) => {
              const rar = (it.rarity as Rarity) in RARITY ? (it.rarity as Rarity) : 'bronze';
              const metric =
                METRIC_BY_PREFIX[
                  Object.keys(METRIC_BY_PREFIX).find((p) => it.key.startsWith(p)) ?? ''
                ];
              const cur = metric ? progresses[metric] : 0;
              const th = thresholdOf(it.key);
              return (
                <div
                  key={it.key}
                  className={`honor-cell ${it.active ? 'on' : it.got ? 'expired' : 'off'}`}
                >
                  <div className="honor-medal">
                    <Medal
                      symbol={it.symbol}
                      rarity={rar}
                      size={78}
                      locked={!it.active && !it.got}
                    />
                    {it.active && it.expiresAt ? (
                      <span className="honor-flair">
                        限时
                        {Math.max(
                          0,
                          Math.ceil((new Date(it.expiresAt).getTime() - Date.now()) / 86400_000),
                        )}
                        天
                      </span>
                    ) : null}
                    {!it.active && it.got ? (
                      <span className="honor-expired-tag">已过期</span>
                    ) : null}
                  </div>
                  <div
                    className="honor-name"
                    style={{ color: it.active ? RARITY[rar].rim : undefined }}
                  >
                    {it.title}
                  </div>
                  {it.active ? (
                    <div className="honor-desc">{it.description}</div>
                  ) : it.got ? (
                    <div className="honor-desc">{it.description}</div>
                  ) : (
                    <div className="honor-desc">
                      {it.description}
                      {th && metric && cur ? (
                        <span className="honor-prog">
                          {cur >= 1000 ? `${(cur / 1000).toFixed(1)}k` : cur} / {th}
                        </span>
                      ) : null}
                    </div>
                  )}
                  {isSelf && it.active ? (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button
                        className={`btn ${it.pinned ? 'btn-light' : 'btn-outline'} btn-sm honor-pin`}
                        disabled={pin.isPending}
                        onClick={() => togglePin(it)}
                      >
                        {it.pinned ? '卸下' : '佩戴'}
                      </button>
                      <button
                        className={`btn ${it.featured ? 'btn-light honor-feat on' : 'btn-outline honor-feat'} btn-sm`}
                        disabled={feat.isPending}
                        title="展示成就：作品卡/评论区/排行榜名字旁挂这一枚（不设则挂佩戴第一枚）"
                        onClick={() => toggleFeat(it)}
                      >
                        {it.featured ? '★ 展示中' : '☆ 设为展示'}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
