'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

/** /creator-center → /user/{id}?tab=works（V3-5 收编） */
export default function CreatorCenterRedirect() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  useEffect(() => {
    if (isLoading) return;
    router.replace(user ? `/user/${user.id}?tab=works` : '/login');
  }, [isLoading, user, router]);
  return <main className="page">加载中…</main>;
}
