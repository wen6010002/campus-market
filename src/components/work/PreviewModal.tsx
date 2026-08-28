'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { toast } from '@/stores/ui';

interface PreviewResult {
  mode: 'full' | 'sample' | 'none';
  url: string | null;
  pages: number;
  hasPreview: boolean;
}

interface Props {
  open: boolean;
  workId: string;
  title: string;
  price?: string;
  /** 水印文字（登录用户名 / 访客） */
  watermark: string;
  onBuy?: () => void;
  onClose: () => void;
}

/** 在线预览（V3-4）：iframe 原生 PDF 查看器。
 *  full = 免费或有权限 → 原文件全量；sample = 付费未购 → 5 页试读副本 + 水印 + 购买卡。
 *  打开即 POST /works/:id/preview（该端点负责签 URL 与观看去重计数）。 */
export function PreviewModal({ open, workId, title, price, watermark, onBuy, onClose }: Props) {
  const [data, setData] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setData(null);
      return;
    }
    let alive = true;
    setLoading(true);
    apiFetch<PreviewResult>(`/works/${workId}/preview`, { method: 'POST' })
      .then((r) => {
        if (!alive) return;
        if (r.mode === 'none') {
          toast('该格式暂不支持在线预览，可下载后查看', 'warn');
          onClose();
        } else {
          setData(r);
        }
      })
      .catch((e) => {
        if (!alive) return;
        toast(e instanceof ApiError ? messageFor(e.code, e.message) : '预览加载失败', 'warn');
        onClose();
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="pv-overlay" onClick={onClose}>
      <div className="pv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pv-bar">
          <b className="pv-title">{title}</b>
          <span className="pv-pages">
            {loading
              ? '加载中…'
              : data
                ? `${data.pages || '?'} 页 · ${data.mode === 'full' ? '完整版' : '试读前 5 页'}`
                : ''}
          </span>
          <button className="btn btn-light btn-sm" onClick={onClose}>
            ✕ 关闭
          </button>
        </div>
        <div className="pv-body">
          {data?.url ? (
            <iframe src={data.url} title={title} className="pv-frame" />
          ) : (
            <div className="pv-loading">正在打开预览…</div>
          )}

          {data?.mode === 'sample' ? (
            <>
              {/* 水印层：斜纹 + 用户名，pointer-events 穿透 */}
              <div className="pv-watermark" aria-hidden>
                {Array.from({ length: 16 }, (_, i) => (
                  <span key={i}>{watermark} · Campus Market</span>
                ))}
              </div>
              <div className="pv-cta">
                <div className="pv-cta-txt">
                  <b>试读到此处</b>
                  <small>购买后解锁完整版，永久下载</small>
                </div>
                <button className="btn btn-primary btn-lg" onClick={onBuy}>
                  ¥{price} 解锁完整版
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
