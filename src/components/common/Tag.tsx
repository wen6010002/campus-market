'use client';

interface ChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

/** 标签（对应原型 .chip，用于评分标签多选等） */
export function Chip({ label, active = false, onClick }: ChipProps) {
  return (
    <span className={`chip ${active ? 'active' : ''}`} onClick={onClick}>
      {label}
    </span>
  );
}

/** 作品标签（对应原型 .t，灰色变体） */
export function Tag({ label, gray = false }: { label: string; gray?: boolean }) {
  return <span className={`t ${gray ? 'gray' : ''}`}>{label}</span>;
}
