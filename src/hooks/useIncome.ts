'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type {
  IncomeSummary,
  IncomeTx,
  Payout,
  CreatorOverview,
  CreatorData,
  WorkWithStats,
} from '@/lib/types';
import type { PayMethod } from '@/lib/constants';

export function useIncomeSummary() {
  return useQuery({
    queryKey: ['income', 'summary'],
    queryFn: () => apiFetch<IncomeSummary>('/me/income/summary'),
  });
}

export function useIncomeTransactions() {
  return useQuery({
    queryKey: ['income', 'transactions'],
    queryFn: () => apiFetch<IncomeTx[]>('/me/income/transactions'),
  });
}

export function usePayouts() {
  return useQuery({
    queryKey: ['income', 'payouts'],
    queryFn: () => apiFetch<Payout[]>('/me/income/payouts'),
  });
}

export function usePayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { amount: number; method: PayMethod }) =>
      apiFetch('/me/income/payout', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income'] });
    },
  });
}

export function useCreatorOverview() {
  return useQuery({
    queryKey: ['creator', 'overview'],
    queryFn: () => apiFetch<CreatorOverview>('/me/creator/overview'),
  });
}

export function useCreatorData() {
  return useQuery({
    queryKey: ['creator', 'data'],
    queryFn: () => apiFetch<CreatorData>('/me/creator/data'),
  });
}

export function useMyWorks() {
  return useQuery({
    queryKey: ['creator', 'works'],
    queryFn: () => apiFetch<WorkWithStats[]>('/me/creator/works'),
  });
}
