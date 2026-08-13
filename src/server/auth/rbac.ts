import type { Role } from '@/lib/constants';

// 权限矩阵（BACKEND.md §6.3）。动作 → 允许的角色集合。
export const PERMISSIONS = {
  upload: ['CREATOR', 'ADMIN'],
  audit: ['ADMIN'],
  payout: ['CREATOR'],
  rate: ['STUDENT', 'CREATOR', 'ADMIN'],
  buy: ['STUDENT', 'CREATOR', 'ADMIN'],
  favorite: ['STUDENT', 'CREATOR', 'ADMIN'],
  follow: ['STUDENT', 'CREATOR', 'ADMIN'],
  like: ['STUDENT', 'CREATOR', 'ADMIN'],
  download: ['STUDENT', 'CREATOR', 'ADMIN'],
  report: ['STUDENT', 'CREATOR', 'ADMIN'],
} as const;

export type PermissionAction = keyof typeof PERMISSIONS;

export function hasPermission(role: Role, action: PermissionAction): boolean {
  return (PERMISSIONS[action] as readonly Role[]).includes(role);
}
