'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { CreateOrderResult, Order, DownloadResult } from '@/lib/types';
import type { PayMethod } from '@/lib/constants';

export function useCreateOrder(workId: string) {
  return useMutation({
    mutationFn: (payMethod: PayMethod) =>
      apiFetch<CreateOrderResult>(`/works/${workId}/order`, {
        method: 'POST',
        body: JSON.stringify({ payMethod }),
      }),
  });
}

/** 订单轮询：非终态每 2s 刷新一次 */
export function useOrder(orderId: string | null) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: () => apiFetch<Order>(`/orders/${orderId}`),
    enabled: !!orderId,
    refetchInterval: (q) => {
      const o = q.state.data;
      return o && (o.payStatus === 'PAID' || o.payStatus === 'CLOSED') ? false : 2000;
    },
  });
}

export function useDownload(workId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<DownloadResult>(`/works/${workId}/download`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['works', 'detail', workId] }),
  });
}
