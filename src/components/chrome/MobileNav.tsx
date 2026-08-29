'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/lib/icons';

type MobileIconName = 'home' | 'search' | 'upload' | 'bell' | 'user';

const items = [
  {
    href: '/',
    label: '首页',
    icon: 'home' as MobileIconName,
    match: (path: string) => path === '/',
  },
  {
    href: '/search',
    label: '搜索',
    icon: 'search' as const,
    match: (path: string) => path.startsWith('/search'),
  },
  {
    href: '/upload',
    label: '发布',
    icon: 'upload' as const,
    match: (path: string) => path.startsWith('/upload'),
  },
  {
    href: '/following',
    label: '动态',
    icon: 'bell' as const,
    match: (path: string) => path.startsWith('/following'),
  },
  {
    href: '/me',
    label: '我的',
    icon: 'user' as const,
    match: (path: string) =>
      path.startsWith('/me') ||
      path.startsWith('/user/') ||
      path.startsWith('/settings') ||
      path.startsWith('/creator-center') ||
      path.startsWith('/income'),
  },
];

function MobileIcon({ name }: { name: MobileIconName }) {
  if (name !== 'home') return <Icon name={name} width={21} />;
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
      <path
        d="m3.5 10 8.5-7 8.5 7v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * H5 主导航。桌面端继续使用顶栏；小屏使用固定底栏，保证高频入口始终可达。
 */
export function MobileNav() {
  const pathname = usePathname();

  // 登录/注册沿用网页端的专注表单体验，不显示应用内底部导航。
  if (pathname === '/login' || pathname === '/register') return null;

  return (
    <nav className="mobile-tabbar" aria-label="移动端主导航">
      {items.map((item) => {
        const active = item.match(pathname);
        return (
          <Link key={item.href} href={item.href} className={`mobile-tab ${active ? 'active' : ''}`}>
            <span className="mobile-tab-icon">
              <MobileIcon name={item.icon} />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
