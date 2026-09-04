'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Empty } from '@/components/common/Empty';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { toast } from '@/stores/ui';

type OpsOverview = {
  generatedAt: string;
  uptimeSeconds: number;
  services: { name: string; state: 'ok' | 'error'; latencyMs: number | null }[];
  metrics: {
    users: number;
    works: number;
    pendingWorks: number;
    openReports: number;
    orders: number;
  };
};

export default function OpsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [tester, setTester] = useState({
    email: 'senior-tester@kedahub.local',
    username: '学长测试',
    password: '',
  });
  const overview = useQuery({
    queryKey: ['admin', 'ops'],
    queryFn: () => apiFetch<OpsOverview>('/admin/ops'),
    enabled: user?.role === 'ADMIN',
    refetchInterval: 30_000,
  });
  const createTester = useMutation({
    mutationFn: () =>
      apiFetch<{ email: string; username: string }>('/admin/ops/tester-account', {
        method: 'POST',
        body: JSON.stringify(tester),
      }),
    onSuccess: (account) => {
      toast(`已创建 ${account.username} 的后台账号`, 'ok');
      setTester((value) => ({ ...value, password: '' }));
    },
  });

  if (authLoading) return <main className="page">加载中…</main>;
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
            <Link className="btn btn-primary" href="/">
              返回首页
            </Link>
          }
        />
      </main>
    );
  }

  const data = overview.data;
  const formatUptime = (seconds?: number) => {
    if (seconds === undefined) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} 小时 ${minutes} 分`;
  };

  return (
    <main className="page">
      <div className="page-head ops-head">
        <div>
          <h1>运维控制台</h1>
          <div className="sub">仅后台管理员可见 · 每 30 秒自动刷新 · 不提供服务器控制操作</div>
        </div>
        <button
          className="btn btn-light"
          onClick={() => overview.refetch()}
          disabled={overview.isFetching}
        >
          {overview.isFetching ? '刷新中…' : '立即刷新'}
        </button>
      </div>

      <section className="ops-section">
        <div className="ops-section-head">
          <h2>运行状态</h2>
          <span>
            {data
              ? `更新于 ${new Date(data.generatedAt).toLocaleString('zh-CN')}`
              : '正在读取状态…'}
          </span>
        </div>
        <div className="ops-services">
          {data?.services.map((service) => (
            <div className="ops-service" key={service.name}>
              <span className={`ops-dot ${service.state}`} />
              <div>
                <b>{service.name}</b>
                <small>{service.state === 'ok' ? '连接正常' : '连接异常'}</small>
              </div>
              <span className="ops-latency">
                {service.latencyMs === null ? '运行中' : `${service.latencyMs} ms`}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="ops-section">
        <div className="ops-section-head">
          <h2>业务概览</h2>
          <span>应用已运行 {formatUptime(data?.uptimeSeconds)}</span>
        </div>
        <div className="stat-grid">
          {(
            [
              ['用户数', data?.metrics.users, '/ops/users'],
              ['课程资料', data?.metrics.works, '/ops/works'],
              ['待审核作品', data?.metrics.pendingWorks, '/admin?tab=works'],
              ['待处理举报', data?.metrics.openReports, '/admin?tab=reports'],
              ['订单数', data?.metrics.orders, '/ops/orders'],
            ] as [string, number | undefined, string][]
          ).map(([label, value, href]) => (
            <Link className="stat-card stat-card-link" href={href} key={label}>
              <div className="lb">{label}</div>
              <div className="v">{value ?? '-'}</div>
              <div className="stat-card-go">管理 →</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="ops-section ops-tester-card">
        <div className="ops-section-head">
          <div>
            <h2>后台测试账号</h2>
            <span>创建后将拥有管理后台和运维面板权限；请通过私密渠道交付密码。</span>
          </div>
        </div>
        <div className="ops-tester-form">
          <input
            className="input"
            value={tester.email}
            onChange={(e) => setTester({ ...tester, email: e.target.value })}
            aria-label="测试账号邮箱"
          />
          <input
            className="input"
            value={tester.username}
            onChange={(e) => setTester({ ...tester, username: e.target.value })}
            aria-label="测试账号名称"
          />
          <input
            className="input"
            type="password"
            value={tester.password}
            onChange={(e) => setTester({ ...tester, password: e.target.value })}
            placeholder="设置至少 12 位、含字母和数字的密码"
            aria-label="测试账号密码"
          />
          <button
            className="btn btn-primary"
            onClick={() => createTester.mutate()}
            disabled={createTester.isPending || !tester.password}
          >
            {createTester.isPending ? '创建中…' : '创建测试账号'}
          </button>
        </div>
        {createTester.error ? (
          <p className="ops-error">
            {createTester.error instanceof ApiError
              ? messageFor(createTester.error.code, createTester.error.message)
              : '创建失败，请稍后重试'}
          </p>
        ) : null}
      </section>
    </main>
  );
}
