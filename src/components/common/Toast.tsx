'use client';

import { useUI } from '@/stores/ui';

const EMOJI: Record<string, string> = { ok: '✓', warn: '⚠', info: '✨' };

export function ToastHost() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span className="em">{EMOJI[t.type] ?? '✨'}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
