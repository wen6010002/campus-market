'use client';

import { Fragment, type ReactNode } from 'react';

/**
 * 路线图步骤/备注富文本：识别 [文字](链接) 与裸 http(s) 链接，渲染成高亮可点 chip。
 * 只放行 http(s) 与站内 / 开头路径；其余（如 javascript:）按普通文本输出。
 * 出现在 <label> 内，点击 stopPropagation 防止误勾 checkbox。
 */
const LINK_RE = /\[([^\]\n]{1,80})\]\(([^)\s]{1,300})\)|(https?:\/\/[^\s）)】\]"'<>]+)/g;

function safeHref(url: string): string | null {
  if (url.startsWith('/')) return url;
  if (/^https?:\/\//.test(url)) return url;
  return null;
}

export function StepRichText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let key = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>);
    const [, label, bracketHref, bareUrl] = m;
    const url = bracketHref ?? bareUrl;
    const href = safeHref(url);
    if (href) {
      nodes.push(
        <a
          key={key++}
          className="rm-link"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {label ?? url}
        </a>,
      );
    } else {
      nodes.push(<Fragment key={key++}>{m[0]}</Fragment>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return <>{nodes}</>;
}
