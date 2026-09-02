'use client';

/**
 * GitHub 风打卡热力图（V4）：纯 CSS grid，7 行 × 26 列（半年）。
 * 色阶按当日完成步骤数分 5 档（品牌橙系）；日期口径与服务端一致（UTC+8）。
 * 顶部按月标注（列首落在新月时显示「8月」），左侧标注周一/周三/周五。
 */
const LEVELS = 5;
const WEEKS = 26;

function todayCn8(): Date {
  return new Date(Date.now() + 8 * 3600_000);
}

function levelFor(count: number): number {
  if (!count) return 0;
  if (count >= 5) return 4;
  if (count >= 3) return 3;
  if (count >= 2) return 2;
  return 1;
}

const WEEKDAY_LABELS = ['', '一', '', '三', '', '五', '']; // 周日~周六，只标一/三/五

export function Heatmap({ byDay }: { byDay: Record<string, number> }) {
  const base = todayCn8();
  // 对齐周网格：从 (WEEKS*7-1) 天前的那一周的周一开始
  const todayDow = base.getUTCDay(); // 0=周日
  const endOffset = 6 - todayDow; // 本周还剩几天（含今天所在的列）
  const cells: { day: string; count: number; month: number }[] = [];
  const total = WEEKS * 7;
  for (let i = total - 1 - endOffset; i >= -endOffset; i--) {
    const d = new Date(base.getTime() - i * 86400_000);
    const day = d.toISOString().slice(0, 10);
    cells.push({ day, count: byDay[day] ?? 0, month: d.getUTCMonth() });
  }
  // 不足整列的尾部补空
  while (cells.length % 7 !== 0) cells.unshift({ day: '', count: 0, month: -1 });

  // 顶部月份标注：每 7 列一组，取该列首行那天所在月；与上一标注不同月才显示（跳过不足 2 列的尾月避免拥挤）
  const monthMarks: (string | null)[] = [];
  let lastMonth = -1;
  for (let col = 0; col < cells.length / 7; col++) {
    const first = cells[col * 7];
    const m = first.month;
    const colsLeft = cells.length / 7 - col;
    if (m !== lastMonth && m >= 0 && colsLeft >= 2) {
      monthMarks.push(`${m + 1}月`);
      lastMonth = m;
    } else {
      monthMarks.push(null);
    }
  }

  const maxCount = Math.max(0, ...Object.values(byDay));

  return (
    <div className="hm-wrap">
      <div className="hm-months">
        {monthMarks.map((label, i) => (
          <span key={i} className="hm-month">
            {label ?? ''}
          </span>
        ))}
      </div>
      <div className="hm-body">
        <div className="hm-weekdays">
          {WEEKDAY_LABELS.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        <div className="hm-grid">
          {cells.map((c, i) =>
            c.day ? (
              <span
                key={i}
                className={`hm-cell l${levelFor(c.count)}`}
                title={c.count ? `${c.day} · 完成 ${c.count} 步` : `${c.day} · 未打卡`}
              />
            ) : (
              <span key={i} className="hm-cell empty" />
            ),
          )}
        </div>
      </div>
      <div className="hm-legend">
        <span>少</span>
        {Array.from({ length: LEVELS }, (_, l) => (
          <span key={l} className={`hm-cell l${l}`} />
        ))}
        <span>多{maxCount > 0 ? `（峰值 ${maxCount} 步/日）` : ''}</span>
      </div>
    </div>
  );
}
