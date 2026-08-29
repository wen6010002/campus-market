'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

/** /me → /user/{id}（V3-5）：旧入口与旧 tab 参数透传 */
export default function MeRedirectPage() {
  return (
    <Suspense fallback={<main className="page">加载中…</main>}>
      <MeRedirect />
    </Suspense>
  );
}

function MeRedirect() {
  const router = useRouter();
  const sp = useSearchParams();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) return router.replace('/login');
    const tab = sp.get('tab');
    const valid = [
      'works',
      'ratings',
      'following',
      'followers',
      'favs',
      'library',
      'orders',
      'income',
      'notif',
    ];
    // 旧 me 页 tab 键与新主页一致（library/favs/orders/notif），不识别的丢弃
    const qs = tab && valid.includes(tab) ? `?tab=${tab}` : '';
    router.replace(`/user/${user.id}${qs}`);
  }, [isLoading, user, router, sp]);

  return <main className="page">加载中…</main>;
}
