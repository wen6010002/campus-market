import type { Role } from '@/lib/constants';

// 权限矩阵（V3-2 开放发布：upload 不再要求创作者认证，登录即可）。
export const PERMISSIONS = {
  upload: ['STUDENT', 'CREATOR', 'ADMIN'],
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
