'use client';

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

interface WorkCoverProps {
  work: {
    id: string;
    title: string;
    course: string;
    coverIcon: string;
    coverTheme: string;
    hasCover?: boolean;
  };
  /** 容器类名（.work-cover / .fine-cover / .cover-top，自带布局与主题底色） */
  containerClassName: string;
  style?: CSSProperties;
  /** 叠加层（徽章等，绝对定位） */
  badges?: ReactNode;
  /** 悬停层（WorkCard 的查看按钮等） */
  overlay?: ReactNode;
}

/** 统一封面（V3-3）：有图片封面（coverKey → /works/{id}/cover 302 代理）渲染 <img>，
 *  无图或加载失败回退 emoji + 主题底；叠加层（徽章/悬停）不遮挡封面内容。 */
export function WorkCover({ work, containerClassName, style, badges, overlay }: WorkCoverProps) {
  const [failed, setFailed] = useState(false);
  const useImg = work.hasCover && !failed;
  return (
    <div className={`${containerClassName} ${work.coverTheme}`} style={style}>
      {useImg ? (
        <img
          className="cover-img"
          src={`/api/v1/works/${work.id}/cover`}
          alt={work.title}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <>
          <div className="glyph">{work.coverIcon}</div>
          <div className="watermark">{work.course}</div>
        </>
      )}
      {badges}
      {overlay}
    </div>
  );
}
