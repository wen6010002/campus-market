'use client';

import { Star } from '@/lib/icons';

interface StarsProps {
  value: number; // 1-5，可为小数（显示四舍五入）
  size?: 'sm' | 'lg' | '';
  clickable?: boolean;
  onChange?: (n: number) => void;
  onHover?: (n: number | null) => void;
}

/** 星级展示（对应原型 starsHTML，含可点击评分态） */
export function Stars({ value, size = '', clickable = false, onChange, onHover }: StarsProps) {
  const rounded = Math.round(value);
  return (
    <span
      className={`stars ${size} ${clickable ? 'clickable' : ''}`}
      onMouseLeave={clickable ? () => onHover?.(null) : undefined}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          style={{ display: 'inline-flex', cursor: clickable ? 'pointer' : undefined }}
          onMouseEnter={clickable ? () => onHover?.(i) : undefined}
          onClick={clickable ? () => onChange?.(i) : undefined}
        >
          <Star on={i <= rounded} />
        </span>
      ))}
    </span>
  );
}
