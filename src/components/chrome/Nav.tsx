'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth, useLogout } from '@/hooks/useAuth';
import { Icon } from '@/lib/icons';

export function Nav() {
  const { user } = useAuth();
  const logout = useLogout();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ddRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && q.trim()) {
      router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      setQ('');
    }
  };

  const unread = user?.unreadCount ?? 0;

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/" className="logo">
          <div className="logo-mark">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M5 4.5C5 3.7 5.7 3 6.5 3h9c.8 0 1.5.7 1.5 1.5v14c0 .8-.7 1.5-1.5 1.5H10l-4 3.2c-.5.4-1.2.1-1.2-.5V4.5Z"
                fill="#fff"
              />
              <path d="M9 9h6M9 12h4" stroke="#ED4E2D" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="logo-text">
            <b>Campus Market</b>
            <span>大学生成长社区</span>
          </div>
        </Link>

        <div className="zone-links" aria-label="专区">
          <Link href="/">🏫 校园专区</Link>
          <Link href="/?zone=growth">🚀 自我提升</Link>
        </div>

        <div className="search">
          <div className="search-box">
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16 }}>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="搜索课程、创作者、免费攻略…"
              autoComplete="off"
            />
            <span className="search-kbd">⌘K</span>
          </div>
        </div>

        <div className="nav-actions">
          <button className="btn-upload" onClick={() => router.push('/upload')}>
            <Icon name="upload" width={14} />
            发布作品
          </button>
          <Link className="nav-link" href="/following">
            <Icon name="bell" width={17} />
            {unread > 0 ? <span className="dot" /> : null}
            <span>动态</span>
          </Link>
          <Link className="nav-link" href="/me?tab=library">
            <Icon name="fav" width={17} />
            <span>学习清单</span>
          </Link>

          {user ? (
            <div className="avatar-wrap" ref={ddRef}>
              <div
                className="avatar"
                style={{ background: user.avatarColor }}
                onClick={() => setOpen((o) => !o)}
              >
                {user.username[0] ?? '?'}
              </div>
              {open ? (
                <div className="dropdown show">
                  <div className="head">
                    <div
                      className="avatar"
                      style={{
                        width: 32,
                        height: 32,
                        fontSize: 13,
                        borderRadius: 5,
                        background: user.avatarColor,
                      }}
                    >
                      {user.username[0]}
                    </div>
                    <div>
                      <b>{user.username}</b>
                      <span>
                        {user.student
                          ? `${user.student.college} · ${user.student.grade}`
                          : '校园用户'}
                      </span>
                    </div>
                  </div>
                  <Link className="dropdown-item" href="/me" onClick={() => setOpen(false)}>
                    <Icon name="user" width={16} /> 个人主页
                  </Link>
                  <Link
                    className="dropdown-item"
                    href="/me?tab=library"
                    onClick={() => setOpen(false)}
                  >
                    📚 我的资料
                  </Link>
                  <Link
                    className="dropdown-item"
                    href="/me?tab=favs"
                    onClick={() => setOpen(false)}
                  >
                    💝 我的收藏
                  </Link>
                  <Link
                    className="dropdown-item"
                    href="/me?tab=orders"
                    onClick={() => setOpen(false)}
                  >
                    🧾 我的订单
                  </Link>
                  <div className="dropdown-divider" />
                  <Link
                    className="dropdown-item"
                    href="/creator-center"
                    onClick={() => setOpen(false)}
                  >
                    🎨 创作者中心
                  </Link>
                  <Link
                    className="dropdown-item"
                    href="/creator-center?tab=data"
                    onClick={() => setOpen(false)}
                  >
                    📊 数据中心
                  </Link>
                  <Link className="dropdown-item" href="/income" onClick={() => setOpen(false)}>
                    💰 我的收益
                  </Link>
                  <Link
                    className="dropdown-item"
                    href="/me?tab=notif"
                    onClick={() => setOpen(false)}
                  >
                    <Icon name="bell" width={16} /> 通知中心{' '}
                    {unread > 0 ? <span className="pill">{unread}</span> : null}
                  </Link>
                  <div className="dropdown-divider" />
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setOpen(false);
                      logout();
                    }}
                  >
                    🚪 退出登录
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <Link className="btn btn-ghost btn-sm" href="/login">
                登录
              </Link>
              <Link className="btn btn-primary btn-sm" href="/register">
                注册
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
