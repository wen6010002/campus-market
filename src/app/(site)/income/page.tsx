'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

/** /income → /user/{id}?tab=income（V3-5 收编） */
export default function IncomeRedirect() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  useEffect(() => {
    if (isLoading) return;
    router.replace(user ? `/user/${user.id}?tab=income` : '/login');
  }, [isLoading, user, router]);
  return <main className="page">加载中…</main>;
}
