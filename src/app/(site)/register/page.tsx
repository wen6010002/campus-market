'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { useInvalidateMe } from '@/hooks/useAuth';

const SCHOOLS = ['深圳大学', '南方科技大学', '其他'];

export default function RegisterPage() {
  const router = useRouter();
  const invalidateMe = useInvalidateMe();
  const [form, setForm] = useState({
    email: '',
    code: '',
    username: '',
    password: '',
    school: '深圳大学',
    college: '',
    major: '',
    grade: '',
  });
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

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function sendCode() {
    setCodeMsg('');
    setErr('');
    if (!form.email) return setCodeMsg('请先填写教育邮箱');
    setSending(true);
    try {
      await apiFetch('/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: form.email }),
      });
      setCodeMsg('验证码已发送，请查收邮箱');
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
      await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(form) });
      await invalidateMe();
      const from = new URLSearchParams(window.location.search).get('from') || '/';
      router.push(from);
    } catch (e) {
      setErr(e instanceof ApiError ? messageFor(e.code, e.message) : '注册失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <div className="card" style={{ width: 440, maxWidth: '100%', padding: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>注册 Campus Market</h1>
        <div className="sub" style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 20 }}>
          需使用 .edu.cn 教育邮箱，验证通过即可加入校园成长社区
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
                value={form.email}
                onChange={set('email')}
                placeholder="yourname@szu.edu.cn"
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
              value={form.code}
              onChange={set('code')}
              placeholder="6 位数字"
              maxLength={6}
              required
            />
          </div>
          <div className="field">
            <label>
              用户名 <span className="req">*</span>
            </label>
            <input
              className="input"
              value={form.username}
              onChange={set('username')}
              placeholder="2-30 字"
              required
            />
          </div>
          <div className="field">
            <label>
              密码 <span className="req">*</span>
            </label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="至少 8 位，含字母和数字"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="field">
            <label>
              学校 <span className="req">*</span>
            </label>
            <select className="input" value={form.school} onChange={set('school')}>
              {SCHOOLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div
            className="field"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
          >
            <div>
              <label>
                学院 <span className="req">*</span>
              </label>
              <input
                className="input"
                value={form.college}
                onChange={set('college')}
                placeholder="计算机与软件学院"
                required
              />
            </div>
            <div>
              <label>
                专业 <span className="req">*</span>
              </label>
              <input
                className="input"
                value={form.major}
                onChange={set('major')}
                placeholder="计算机科学与技术"
                required
              />
            </div>
          </div>
          <div className="field">
            <label>
              年级 <span className="req">*</span>
            </label>
            <input
              className="input"
              value={form.grade}
              onChange={set('grade')}
              placeholder="如：大二"
              required
            />
          </div>
          {err ? (
            <div style={{ color: 'var(--pri-700)', fontSize: 12.5, marginBottom: 12 }}>{err}</div>
          ) : null}
          <button className="btn btn-primary btn-lg btn-block" disabled={loading}>
            {loading ? '注册中…' : '注册'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--ink-soft)' }}>
          已有账号？{' '}
          <Link href="/login" style={{ color: 'var(--pri-600)', fontWeight: 600 }}>
            直接登录
          </Link>
        </div>
      </div>
    </main>
  );
}
