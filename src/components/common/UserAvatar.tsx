'use client';

import { useEffect, useState } from 'react';

/** 用户头像（V3-5；V3 头像同步修复）：avatarKey → /users/:id/avatar 302 代理；
 *  无图或加载失败回退色块首字母。avatarVer 用于缓存穿透——头像更新后 URL 变化，绕开浏览器 1h 缓存。 */
export function UserAvatar({
  id,
  user,
  size = 64,
  radius = 12,
}: {
  id: string;
  user: { username: string; avatarColor: string; hasAvatar?: boolean; avatarVer?: number };
  size?: number;
  radius?: number;
}) {
  const [failed, setFailed] = useState(false);
  // 头像版本变化（上传新头像）时重置失败态，避免 404 一次后永远回退色块
  useEffect(() => {
    setFailed(false);
  }, [user.avatarVer, user.hasAvatar]);
  const useImg = user.hasAvatar && !failed;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: user.avatarColor,
        display: 'grid',
        placeItems: 'center',
        color: '#fff',
        fontWeight: 800,
        fontSize: Math.round(size / 2.5),
        overflow: 'hidden',
        flex: 'none',
      }}
    >
      {useImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/v1/users/${id}/avatar${user.avatarVer ? `?v=${user.avatarVer}` : ''}`}
          alt={user.username}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        (user.username[0] ?? '?')
      )}
    </div>
  );
}
