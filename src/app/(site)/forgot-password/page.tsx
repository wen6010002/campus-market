'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [err, setErr] = useState('');
  const [codeMsg, setCodeMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function sendCode() {
    setCodeMsg('');
    setErr('');
    if (!email) return setCodeMsg('请先填写教育邮箱');
    setSending(true);
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      // 文案本身防枚举：不区分邮箱是否已注册
      setCodeMsg('如果该邮箱已注册，验证码已发送，请查收');
      setCountdown(60);
    } catch (e) {
      setCodeMsg(e instanceof ApiError ? messageFor(e.code, e.message) : '发送失败');
    } finally {
      setSending(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code, newPassword }),
      });
      router.push('/login');
    } catch (e) {
      setErr(e instanceof ApiError ? messageFor(e.code, e.message) : '重置失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="page auth-page"
      style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}
    >
      <div className="card" style={{ width: 440, maxWidth: '100%', padding: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>重置密码</h1>
        <div className="sub" style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 20 }}>
          使用注册的深大教育邮箱接收验证码，设置新密码后所有设备需重新登录
        </div>
        <form onSubmit={submit}>
          <div className="field">
            <label>
              教育邮箱 <span className="req">*</span>
            </label>
            <div className="input-group">
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@mails.szu.edu.cn"
                autoComplete="email"
                required
              />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={sendCode}
                disabled={sending || countdown > 0}
                style={{ flexShrink: 0 }}
              >
                {countdown > 0 ? `${countdown}s` : '发送验证码'}
              </button>
            </div>
            {codeMsg ? (
              <div className="hint" style={{ color: 'var(--ink-soft)' }}>
                {codeMsg}
              </div>
            ) : null}
          </div>
          <div className="field">
            <label>
              验证码 <span className="req">*</span>
            </label>
            <input
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6 位数字"
              maxLength={6}
              required
            />
          </div>
          <div className="field">
            <label>
              新密码 <span className="req">*</span>
            </label>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="至少 8 位，含字母和数字"
              autoComplete="new-password"
              required
            />
          </div>
          {err ? (
            <div style={{ color: 'var(--pri-700)', fontSize: 12.5, marginBottom: 12 }}>{err}</div>
          ) : null}
          <button className="btn btn-primary btn-lg btn-block" disabled={loading}>
            {loading ? '重置中…' : '重置密码'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--ink-soft)' }}>
          想起密码了？{' '}
          <Link href="/login" style={{ color: 'var(--pri-600)', fontWeight: 600 }}>
            返回登录
          </Link>
        </div>
      </div>
    </main>
  );
}
