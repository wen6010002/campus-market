'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { Empty } from '@/components/common/Empty';
import { useAuth } from '@/hooks/useAuth';

/** /ops 子页共用守卫：未登录/非 ADMIN 显示占位（与 /ops 首页同文案风格） */
export function OpsGuard({ children, backHref }: { children: ReactNode; backHref?: string }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <main className="page">加载中…</main>;
  if (!user) {
    return (
      <main className="page">
        <Empty
          icon="🔒"
          title="请先登录"
          desc="运维面板仅限后台管理员使用"
          action={
            <Link className="btn btn-primary" href="/login?from=/ops">
              去登录
            </Link>
          }
        />
      </main>
    );
  }
  if (user.role !== 'ADMIN') {
    return (
      <main className="page">
        <Empty
          icon="🚫"
          title="无后台访问权限"
          desc="运维面板仅对管理员开放"
          action={
            <Link className="btn btn-primary" href={backHref ?? '/'}>
              返回
            </Link>
          }
        />
      </main>
    );
  }
  return <>{children}</>;
}

/** 简易分页条（/ops 列表页共用） */
export function Pager({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="ops-pager">
      <span className="ops-pager-total">共 {total} 条</span>
      <button
        className="btn btn-light btn-sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        上一页
      </button>
      <span className="ops-pager-now">
        {page} / {Math.max(totalPages, 1)}
      </span>
      <button
        className="btn btn-light btn-sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        下一页
      </button>
    </div>
  );
}
