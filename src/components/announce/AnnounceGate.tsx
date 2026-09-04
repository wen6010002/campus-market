'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal, ModalHead, ModalBody, ModalFoot } from '@/components/common/Modal';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api/client';
import type { Announcement } from '@/lib/types';

const SESSION_FLAG = 'cm_announced';

/**
 * 登录弹公告（V4）：有 user 且存在未读公告且本浏览器会话未弹过 → Modal 展示最新一条。
 * 关闭 = 全部标记已读（下次登录无新公告不再弹）+ sessionStorage 防同会话重复弹。
 */
export function AnnounceGate() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // 初始即检查：同会话弹过就不再弹
    try {
      setDismissed(sessionStorage.getItem(`${SESSION_FLAG}:${user?.id ?? ''}`) === '1');
    } catch {
      setDismissed(false);
    }
  }, [user?.id]);

  const unread = useQuery({
    queryKey: ['announcements', 'unread', user?.id],
    queryFn: () =>
      apiFetch<Announcement[]>('/announcements?unread=true&pageSize=5'),
    enabled: !!user,
    staleTime: 60_000,
  });

  const latest = unread.data?.[0];
  const more = (unread.data?.length ?? 0) - 1;
  const open = !!user && !dismissed && !!latest;

  const close = async () => {
    try {
      sessionStorage.setItem(`${SESSION_FLAG}:${user?.id ?? ''}`, '1');
    } catch {
      /* 隐私模式下忽略 */
    }
    setDismissed(true);
    try {
      await apiFetch('/announcements/read-all', { method: 'POST' });
    } catch {
      /* 失败不打断关闭；下次登录会再弹一次，可接受 */
    }
    qc.invalidateQueries({ queryKey: ['announcements'] });
    qc.invalidateQueries({ queryKey: ['me'] });
  };

  return (
    <Modal open={open} onClose={close}>
      {latest ? (
        <>
          <ModalHead
            title={latest.level === 'IMPORTANT' ? '📢 重要公告' : '📢 平台公告'}
            sub={`发布于 ${new Date(latest.publishedAt).toLocaleString('zh-CN')} · ${latest.author.username}`}
            onClose={close}
          />
          <ModalBody>
            <div className="ann-gate-title">{latest.title}</div>
            <div
              className={`ann-gate-content ${latest.level === 'IMPORTANT' ? 'important' : ''}`}
              dangerouslySetInnerHTML={{ __html: latest.content }}
            />
          </ModalBody>
          <ModalFoot>
            {more > 0 ? (
              <Link className="btn btn-light" href="/announcements" onClick={close}>
                还有 {more} 条公告 →
              </Link>
            ) : (
              <Link className="btn btn-light" href="/announcements" onClick={close}>
                查看全部公告
              </Link>
            )}
            <button className="btn btn-primary" onClick={close}>
              我知道了
            </button>
          </ModalFoot>
        </>
      ) : null}
    </Modal>
  );
}
