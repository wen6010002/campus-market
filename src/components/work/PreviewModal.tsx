'use client';

import { useEffect, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { apiFetch, ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { toast } from '@/stores/ui';

interface PreviewResult {
  mode: 'full' | 'sample' | 'none';
  /** PDF：MinIO inline 预签名 URL（iframe 用） */
  url?: string | null;
  /** MD：服务端直回的文本（full=原文 / sample=试读副本），前端渲染 */
  content?: string | null;
  pages: number;
  hasPreview: boolean;
}

interface Props {
  open: boolean;
  workId: string;
  /** PDF → iframe 原生查看器；MD → marked+DOMPurify 渲染 */
  fileType?: 'PDF' | 'MD' | string;
  title: string;
  price?: string;
  /** 水印文字（登录用户名 / 访客） */
  watermark: string;
  onBuy?: () => void;
  onClose: () => void;
}

/** 在线预览（V3-4，md 扩展）。
 *  PDF：iframe 原生查看器；MD：服务端回文本 → marked 转 HTML → DOMPurify 消毒后渲染（用户上传的 md 可嵌脚本，必须消毒）。
 *  full = 免费或有权限 → 原文件全量；sample = 付费未购 → 试读副本（PDF 前 5 页 / MD 前 30%）+ 水印 + 购买卡。
 *  打开即 POST /works/:id/preview（该端点负责取内容与观看去重计数）。 */

// md → 安全 HTML（同步解析；GFM 表格/删除线默认开）
function renderMd(text: string): string {
  return DOMPurify.sanitize(marked.parse(text, { async: false }), {
    FORBID_TAGS: ['style', 'form', 'input', 'iframe'],
  });
}

export function PreviewModal({
  open,
  workId,
  fileType = 'PDF',
  title,
  price,
  watermark,
  onBuy,
  onClose,
}: Props) {
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

  const isMd = fileType === 'MD';
  const html = isMd && data?.content ? renderMd(data.content) : null;

  return (
    <div className="pv-overlay" onClick={onClose}>
      <div className="pv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pv-bar">
          <b className="pv-title">{title}</b>
          <span className="pv-pages">
            {loading
              ? '加载中…'
              : data
                ? isMd
                  ? `Markdown · ${data.mode === 'full' ? '完整版' : '试读版'}`
                  : `${data.pages || '?'} 页 · ${data.mode === 'full' ? '完整版' : '试读前 5 页'}`
                : ''}
          </span>
          <button className="btn btn-light btn-sm" onClick={onClose}>
            ✕ 关闭
          </button>
        </div>
        <div className="pv-body">
          {isMd ? (
            html ? (
              <div className="md-body" dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <div className="pv-loading">正在打开预览…</div>
            )
          ) : data?.url ? (
            <iframe src={data.url} title={title} className="pv-frame" />
          ) : (
            <div className="pv-loading">正在打开预览…</div>
          )}

          {data?.mode === 'sample' ? (
            <>
              {/* 水印层：斜纹 + 用户名，pointer-events 穿透 */}
              <div className="pv-watermark" aria-hidden>
                {Array.from({ length: 16 }, (_, i) => (
                  <span key={i}>{watermark} · 课搭</span>
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
