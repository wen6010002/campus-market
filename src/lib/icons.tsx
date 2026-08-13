// 原型内联 SVG 图标提取（app.js ICONS）。统一 <Icon name=... width=... /> 渲染。
import React from 'react';

const PATHS: Record<string, React.ReactNode> = {
  eye: (
    <>
      <path
        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" fill="none" />
    </>
  ),
  like: (
    <path
      d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"
      stroke="currentColor"
      strokeWidth="1.8"
      fill="none"
    />
  ),
  fav: (
    <path
      d="M6 5h12l-1 5a5 5 0 0 1-10 0L6 5Z"
      stroke="currentColor"
      strokeWidth="1.8"
      fill="none"
    />
  ),
  dl: (
    <path
      d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      fill="none"
    />
  ),
  com: (
    <path
      d="M4 5h16v11H8l-4 3V5Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),
  file: (
    <>
      <path d="M7 3h7l5 5v13H7Z" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.7" fill="none" />
    </>
  ),
  lock: (
    <>
      <rect
        x="5"
        y="11"
        width="14"
        height="9"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" fill="none" />
    </>
  ),
  share: (
    <>
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle cx="18" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle cx="18" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="m8 11 8-4M8 13l8 4" stroke="currentColor" strokeWidth="1.8" fill="none" />
    </>
  ),
  flag: (
    <path
      d="M5 21V4m0 1h11l-2 4 2 4H5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  check: (
    <path
      d="m5 12 4 4 10-10"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  bell: (
    <>
      <path
        d="M4 8a8 8 0 0 1 16 0v5l1.5 3.5h-19L4 13V8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M10 19a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
      <path
        d="m20 20-3-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),
  upload: (
    <>
      <path
        d="M12 16V4m0 0L8 8m4-4 4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M4 16v2.5C4 19.9 5 21 6.5 21h11c1.4 0 2.5-1.1 2.5-2.5V16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M4 20a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.8" fill="none" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, width = 15 }: { name: IconName; width?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width, height: width }}>
      {PATHS[name]}
    </svg>
  );
}

/** 星级 SVG（原型 starSVG） */
export function Star({ on = true }: { on?: boolean }) {
  return (
    <svg className={on ? 's-on' : 's-off'} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.2l2.9 6 6.6.6-5 4.3 1.5 6.4L12 16.9 6.4 20.5l1.5-6.4-5-4.3 6.6-.6z" />
    </svg>
  );
}
