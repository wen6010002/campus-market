'use client';

import { Star } from '@/lib/icons';

interface StarsProps {
  value: number; // 1-5，可为小数（≥.75 进位整星，.25~.75 显示半星）
  size?: 'sm' | 'lg' | '';
  clickable?: boolean;
  onChange?: (n: number) => void;
  onHover?: (n: number | null) => void;
}

/** 半星（底层灰星 + 上层裁切 50% 的亮星叠加） */
function HalfStar() {
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <Star on={false} />
      <span style={{ position: 'absolute', inset: 0, width: '50%', overflow: 'hidden' }}>
        <Star on />
      </span>
    </span>
  );
}

/** 星级展示（对应原型 starsHTML，含可点击评分态；展示态支持半星） */
export function Stars({ value, size = '', clickable = false, onChange, onHover }: StarsProps) {
  const full = Math.floor(value);
  const frac = value - full;
  const half = frac >= 0.25 && frac < 0.75;
  const rounded = half ? full : Math.round(value);
  return (
    <span
      className={`stars ${size} ${clickable ? 'clickable' : ''}`}
      onMouseLeave={clickable ? () => onHover?.(null) : undefined}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const isHalf = !clickable && half && i === full + 1;
        return (
          <span
            key={i}
            style={{ display: 'inline-flex', cursor: clickable ? 'pointer' : undefined }}
            onMouseEnter={clickable ? () => onHover?.(i) : undefined}
            onClick={clickable ? () => onChange?.(i) : undefined}
          >
            {isHalf ? <HalfStar /> : <Star on={i <= rounded} />}
          </span>
        );
      })}
    </span>
  );
}
