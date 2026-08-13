'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { useInvalidateMe } from '@/hooks/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const invalidateMe = useInvalidateMe();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await invalidateMe();
      const from = new URLSearchParams(window.location.search).get('from') || '/';
      router.push(from);
    } catch (e) {
      setErr(e instanceof ApiError ? messageFor(e.code) : '登录失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <div className="card" style={{ width: 400, maxWidth: '100%', padding: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>登录 Campus Market</h1>
        <div className="sub" style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 20 }}>
          分享知识 → 帮助同学 → 获得影响力 → 获得收益
        </div>
        <form onSubmit={submit}>
          <div className="field">
            <label>教育邮箱</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yourname@szu.edu.cn"
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label>密码</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
              autoComplete="current-password"
              required
            />
          </div>
          {err ? (
            <div style={{ color: 'var(--pri-700)', fontSize: 12.5, marginBottom: 12 }}>{err}</div>
          ) : null}
          <button className="btn btn-primary btn-lg btn-block" disabled={loading}>
            {loading ? '登录中…' : '登录'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--ink-soft)' }}>
          还没有账号？{' '}
          <Link href="/register" style={{ color: 'var(--pri-600)', fontWeight: 600 }}>
            立即注册
          </Link>
        </div>
      </div>
    </main>
  );
}
