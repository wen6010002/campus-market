import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '../db';
import { appError } from '../lib/errors';
import { cacheGet, cacheSet, userStatusKey } from '../lib/cache';
import type { Role } from '@/lib/constants';

const COOKIE = process.env.JWT_COOKIE_NAME ?? 'cm_token';
const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'dev-secret-32-bytes-minimum-length',
);
const SESSION_DAYS = 7;

export interface Session {
  userId: string;
  role: Role;
  creatorProfileId?: string;
  pwdVer: number; // 签发时的密码版本；改密/重置后库中 pwdVersion++，比对不一致即 401 踢线（V5）
}

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({ role: s.role, creatorProfileId: s.creatorProfileId, pwdVer: s.pwdVer })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(s.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      role: payload.role as Role,
      creatorProfileId: payload.creatorProfileId as string | undefined,
      // V5 之前的 JWT 无此 claim → 0，与存量用户 pwdVersion 默认值相等，不误踢
      pwdVer: (payload.pwdVer as number | undefined) ?? 0,
    };
  } catch {
    return null;
  }
}

/** 从 cookie 解析当前会话（不查库，仅 JWT 声明） */
export async function getSession(): Promise<Session | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

type UserStatus = { status: string; bannedReason: string | null; pwdVer: number } | false;

export async function requireUser(): Promise<Session> {
  const s = await getSession();
  if (!s) throw appError('UNAUTHENTICATED', '请先登录');
  // 封号拦截 + 密码版本踢线：JWT 无状态，需核对用户状态。每个登录态请求都走这里——
  // 加 30s Redis 缓存（P0-2），封号/解封/改密在处置时主动失效，做到准实时。
  let status = await cacheGet<UserStatus>(userStatusKey(s.userId));
  // 滚动发布防御：旧副本可能写入无 pwdVer 的旧结构缓存，视为 miss 回库重读
  if (status !== false && status !== null && typeof status.pwdVer !== 'number') status = null;
  if (status === null) {
    const user = await prisma.user.findUnique({
      where: { id: s.userId },
      select: { status: true, bannedReason: true, pwdVersion: true },
    });
    status = user
      ? { status: user.status, bannedReason: user.bannedReason, pwdVer: user.pwdVersion }
      : false;
    await cacheSet(userStatusKey(s.userId), status, 30);
  }
  if (status === false || status.status === 'BANNED') {
    throw appError(
      'FORBIDDEN',
      status && status.bannedReason ? `账号已被封禁：${status.bannedReason}` : '账号已被封禁',
    );
  }
  if (s.pwdVer !== status.pwdVer) {
    throw appError('UNAUTHENTICATED', '登录已过期，请重新登录');
  }
  return s;
}

export async function requireAdmin(): Promise<Session> {
  const s = await requireUser();
  if (s.role !== 'ADMIN') throw appError('FORBIDDEN', '需要管理员权限');
  return s;
}

/** 发布门槛核心（可单测）：无 CreatorProfile 则自动创建（未认证徽章），STUDENT 升级 CREATOR。
 *  verified 不再是发布门槛，仅作认证徽章展示；收益/提现链路照旧挂靠 CreatorProfile。 */
export async function ensureCreatorProfile(userId: string): Promise<string> {
  let cp = await prisma.creatorProfile.findUnique({ where: { userId } });
  if (!cp) {
    cp = await prisma.creatorProfile.create({
      data: {
        userId,
        bio: '',
        direction: '校园分享者',
        verified: false,
        wallet: { create: { balance: 0, pending: 0, withdrawn: 0 } }, // 无钱包会让首单结算事务失败
      },
    });
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === 'STUDENT') {
    await prisma.user.update({ where: { id: userId }, data: { role: 'CREATOR' } });
  }
  return cp.id;
}

/** 发布门槛（V3-2 开放发布）：登录即可，ensureCreatorProfile 自动补档案。 */
export async function ensurePublisher(): Promise<Session & { creatorProfileId: string }> {
  const s = await requireUser();
  const creatorProfileId = await ensureCreatorProfile(s.userId);
  return {
    ...s,
    role: s.role === 'STUDENT' ? 'CREATOR' : s.role,
    creatorProfileId,
  };
}

/** 会话 cookie 配置（httpOnly + SameSite=Lax + 生产 Secure） */
export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};

export const SESSION_COOKIE = COOKIE;
