'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { renderMd, splitMdHead } from '@/lib/md';

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
  workId: string;
  fileType: 'PDF' | 'MD' | string;
  /** sample 模式（付费未购）点「解锁完整版」*/
  onBuy?: () => void;
  /** 打开全屏阅读弹窗 */
  onFullscreen: () => void;
}

type LoadState = 'idle' | 'loading' | 'error' | 'done';

/** 详情页内嵌预览（V11）：预览区进入视口时自动 POST /works/:id/preview 一次，
 *  MD 渲染前 ~30%（标题行边界截断）+「展开全文」前端展开（不发第二次请求）；
 *  PDF 走 iframe 内嵌滚动；付费未购 sample 由服务端截断，尾部是解锁 CTA。
 *  观看计数安全：服务端同人/同 IP 24h 去重，自动加载 = 每人每天至多 +1。 */
export function WorkPreviewInline({ workId, fileType, onBuy, onFullscreen }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<LoadState>('idle');
  const [data, setData] = useState<PreviewResult | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const isMd = fileType === 'MD';

  async function load() {
    setState('loading');
    try {
      const r = await apiFetch<PreviewResult>(`/works/${workId}/preview`, { method: 'POST' });
      setData(r);
      setState('done');
    } catch (e) {
      setErrMsg(e instanceof ApiError ? messageFor(e.code, e.message) : '预览加载失败');
      setState('error');
    }
  }

  // 进入视口（含 200px 提前量）自动加载一次；快速滚动只触发一次
  useEffect(() => {
    if (state !== 'idle') return;
    const el = rootRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      load();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          load();
        }
      },
      { rootMargin: '200px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!isMd && fileType !== 'PDF') return null;

  const mdText = isMd && data?.mode !== 'none' ? (data?.content ?? '') : '';
  const split = mdText && data?.mode === 'full' ? splitMdHead(mdText) : null;
  const partHtml = mdText ? renderMd(split ? split.part : mdText) : '';
  const restHtml = split ? renderMd(split.rest) : '';

  const statusText =
    state !== 'done'
      ? ''
      : data?.mode === 'sample'
        ? '试读版'
        : isMd
          ? split && !expanded
            ? '已展示前 30%'
            : '完整版'
          : `${data?.pages || '?'} 页 · 完整版`;

  return (
    <section className="pv-inline" ref={rootRef} aria-label="在线预览">
      <div className="pvi-head">
        <h2 className="wd-sec">预 览</h2>
        <div className="pvi-tools">
          {statusText ? <span className="pvi-status">{statusText}</span> : null}
          {state === 'done' && data?.hasPreview ? (
            <button className="btn btn-light btn-sm" onClick={onFullscreen}>
              ⛶ 全屏
            </button>
          ) : null}
        </div>
      </div>

      <div className="pvi-panel">
        {state === 'loading' || state === 'idle' ? (
          <div className="pvi-loading">正在打开预览…</div>
        ) : state === 'error' ? (
          <div className="pvi-error">
            <span>{errMsg}</span>
            <button className="btn btn-light btn-sm" onClick={load}>
              重试
            </button>
          </div>
        ) : data?.mode === 'none' ? (
          <div className="pvi-none">该格式暂不支持在线预览，可下载后查看</div>
        ) : isMd ? (
          <>
            <div className={`wd-reader ${split && !expanded ? 'reader-fade' : ''}`}>
              {/* md 经 marked + DOMPurify 消毒（lib/md），可安全注入 */}
              <div className="md-body" dangerouslySetInnerHTML={{ __html: partHtml }} />
            </div>

            {data?.mode === 'sample' ? (
              <div className="reader-cta">
                <div className="reader-cta-txt">
                  <b>试读到此处</b>
                  <small>购买后解锁完整版，永久下载</small>
                </div>
                <button className="btn btn-primary btn-lg" onClick={onBuy}>
                  解锁完整版
                </button>
              </div>
            ) : split ? (
              expanded ? (
                <div className="wd-reader" style={{ paddingTop: 0 }}>
                  <div className="md-body" dangerouslySetInnerHTML={{ __html: restHtml }} />
                </div>
              ) : null
            ) : null}

            {data?.mode === 'full' && split ? (
              <div className="reader-more">
                <button className="btn btn-primary" onClick={() => setExpanded((v) => !v)}>
                  {expanded ? '收起' : '展开全文'}
                </button>
                <span className="note">
                  {expanded ? '全文已展开 · 可随时收起' : '剩余内容已就绪，点开不用等加载'}
                </span>
              </div>
            ) : null}
          </>
        ) : data?.url ? (
          <iframe src={data.url} title="预览" className="pvi-frame" />
        ) : (
          <div className="pvi-loading">正在打开预览…</div>
        )}
      </div>
    </section>
  );
}
