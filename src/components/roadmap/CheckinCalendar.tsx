'use client';

import { useState } from 'react';

/**
 * 打卡月历（V4）：路线图详情右栏，展示某月每天打卡情况（当日完成步数着色）。
 * 数据与热力图同源（progress.byDay，UTC+8 日期键），可前后翻月。
 */
function levelFor(count: number): number {
  if (!count) return 0;
  if (count >= 5) return 4;
  if (count >= 3) return 3;
  if (count >= 2) return 2;
  return 1;
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

export function CheckinCalendar({ byDay }: { byDay: Record<string, number> }) {
  // 全程用 UTC+8 日期空间（与 byDay 键一致）
  const nowCn8 = new Date(Date.now() + 8 * 3600_000);
  const [cursor, setCursor] = useState({ y: nowCn8.getUTCFullYear(), m: nowCn8.getUTCMonth() });

  const todayKey = nowCn8.toISOString().slice(0, 10);
  const firstOfMonth = new Date(Date.UTC(cursor.y, cursor.m, 1));
  const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
  // 周一为第一列：周日(0) 归到最后一列
  const leadBlanks = (firstOfMonth.getUTCDay() + 6) % 7;

  const prevDisabled =
    cursor.y === nowCn8.getUTCFullYear() - 1 && cursor.m === nowCn8.getUTCMonth();
  const nextDisabled = cursor.y === nowCn8.getUTCFullYear() && cursor.m === nowCn8.getUTCMonth();

  const goPrev = () => {
    const d = new Date(Date.UTC(cursor.y, cursor.m - 1, 1));
    setCursor({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };
  const goNext = () => {
    const d = new Date(Date.UTC(cursor.y, cursor.m + 1, 1));
    setCursor({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };

  const days: { key: string; num: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Date.UTC(cursor.y, cursor.m, d));
    days.push({ key: date.toISOString().slice(0, 10), num: d });
  }

  const monthChecks = days.reduce((n, d) => n + (byDay[d.key] ?? 0), 0);
  const activeDays = days.filter((d) => byDay[d.key]).length;

  return (
    <div className="cal-wrap">
      <div className="cal-head">
        <button className="cal-nav" onClick={goPrev} disabled={prevDisabled} aria-label="上一月">
          ‹
        </button>
        <b className="cal-title">
          {cursor.y} 年 {cursor.m + 1} 月
        </b>
        <button className="cal-nav" onClick={goNext} disabled={nextDisabled} aria-label="下一月">
          ›
        </button>
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className="cal-weekday">
            {w}
          </span>
        ))}
        {Array.from({ length: leadBlanks }, (_, i) => (
          <span key={`b${i}`} className="cal-day blank" />
        ))}
        {days.map((d) => {
          const count = byDay[d.key] ?? 0;
          const isToday = d.key === todayKey;
          const isFuture = d.key > todayKey;
          return (
            <span
              key={d.key}
              className={`cal-day l${levelFor(count)}${isToday ? ' today' : ''}${isFuture ? ' future' : ''}`}
              title={count ? `${d.key} · 完成 ${count} 步` : `${d.key} · 未打卡`}
            >
              {d.num}
            </span>
          );
        })}
      </div>
      <div className="cal-summary">
        本月打卡 <b>{activeDays}</b> 天 · 完成 <b>{monthChecks}</b> 步
      </div>
    </div>
  );
}
