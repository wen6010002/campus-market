'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth, useLogout } from '@/hooks/useAuth';
import { UserAvatar } from '@/components/common/UserAvatar';
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
            <span className="logo-glyph" aria-hidden="true">
              课
            </span>
          </div>
          <div className="logo-text">
            <b>课搭</b>
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
              <div className="avatar nav-avatar-btn" onClick={() => setOpen((o) => !o)}>
                <UserAvatar id={user.id} user={user} size={34} radius={8} />
              </div>
              {open ? (
                <div className="dropdown show">
                  <div className="head">
                    <UserAvatar id={user.id} user={user} size={32} radius={7} />
                    <div>
                      <b>{user.username}</b>
                      <span>
                        {user.student
                          ? `${user.student.college} · ${user.student.grade}`
                          : '校园用户'}
                      </span>
                    </div>
                  </div>
                  <Link
                    className="dropdown-item"
                    href={`/user/${user.id}`}
                    onClick={() => setOpen(false)}
                  >
                    <Icon name="user" width={16} /> 个人主页
                  </Link>
                  <Link className="dropdown-item" href="/upload" onClick={() => setOpen(false)}>
                    <Icon name="upload" width={16} /> 发布作品
                  </Link>
                  <Link
                    className="dropdown-item"
                    href={`/user/${user.id}?tab=notif`}
                    onClick={() => setOpen(false)}
                  >
                    <Icon name="bell" width={16} /> 通知中心{' '}
                    {unread > 0 ? <span className="pill">{unread}</span> : null}
                  </Link>
                  {user.role === 'ADMIN' ? (
                    <>
                      <Link className="dropdown-item" href="/admin" onClick={() => setOpen(false)}>
                        🛡 管理后台
                      </Link>
                      <Link className="dropdown-item" href="/ops" onClick={() => setOpen(false)}>
                        📊 运维控制台
                      </Link>
                    </>
                  ) : null}
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
