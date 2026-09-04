import { prisma } from '../db';
import { appError } from '../lib/errors';
import { enforceRateLimit } from '../lib/ratelimit';
import { sendVerifyCode, sendResetCode } from '../lib/mailer';
import { hashPassword, verifyPassword } from '../auth/password';
import { isEduEmail, generateCode, saveCode, consumeCode } from '../auth/verify-code';
import { announceService } from './announce.service';
import { cacheGet, cacheSet, cacheDel, userStatusKey, meKey } from '../lib/cache';
import type {
  RegisterInput,
  LoginInput,
  CreatorApplyInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from '@/lib/zod/auth';

const RL_VERIFY_PER_HOUR = Number(process.env.RL_VERIFY_PER_HOUR ?? 5);
const RL_LOGIN_PER_MIN = Number(process.env.RL_LOGIN_PER_MIN ?? 10);
const RL_RESET_PER_HOUR = Number(process.env.RL_RESET_PER_HOUR ?? 5);
const RL_RESET_TRY_PER_HOUR = Number(process.env.RL_RESET_TRY_PER_HOUR ?? 10);
const RL_PWD_PER_MIN = Number(process.env.RL_PWD_PER_MIN ?? 10);

/** /auth/me 30s 短缓存（P1-3）：Nav 每页都拉；失效点见各写路径（资料/通知/公告/封禁） */
export async function buildAuthUserCached(userId: string) {
  const hit = await cacheGet<Awaited<ReturnType<typeof buildAuthUser>>>(meKey(userId));
  if (hit) return hit;
  const data = await buildAuthUser(userId);
  await cacheSet(meKey(userId), data, 30);
  return data;
}

// 构建 AuthUser 响应（契约 §3）
export async function buildAuthUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { student: true, creator: true },
  });
  if (!user) throw appError('NOT_FOUND', '用户不存在');
  const [unreadCount, unreadAnnouncements] = await Promise.all([
    prisma.notification.count({ where: { userId, read: false } }),
    announceService.unreadCount(userId),
  ]);
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    avatarColor: user.avatarColor,
    hasAvatar: !!user.avatarKey,
    avatarVer: user.updatedAt.getTime(),
    bio: user.bio ?? user.creator?.bio ?? '',
    unreadCount,
    unreadAnnouncements,
    student: user.student
      ? {
          school: user.student.school,
          college: user.student.college,
          major: user.student.major,
          grade: user.student.grade,
          verifyStatus: user.student.verifyStatus,
        }
      : undefined,
    creator: user.creator
      ? {
          id: user.creator.id,
          bio: user.creator.bio,
          direction: user.creator.direction,
          honor: user.creator.honor,
          verified: user.creator.verified,
        }
      : null,
  };
}

export const authService = {
  /** 发送注册验证码（校园封闭域名，已注册邮箱直接提示去登录，不做防枚举假发送） */
  async sendCode(email: string) {
    if (!isEduEmail(email)) throw appError('NOT_EDU', '请使用深圳大学教育邮箱');
    await enforceRateLimit(`rl:verify:${email.toLowerCase()}`, RL_VERIFY_PER_HOUR, 3600_000);

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) throw appError('EMAIL_TAKEN', '该邮箱已注册，请直接登录；忘记密码可用邮箱找回');

    const code = generateCode();
    await saveCode(email, code, 'register');
    await sendVerifyCode(email, code);
    return { ok: true };
  },

  /** 注册（消费验证码 → 建用户 + 学生档案） */
  async register(input: RegisterInput) {
    const email = input.email.toLowerCase();
    await consumeCode(email, input.code, 'register');

    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken) throw appError('EMAIL_TAKEN', '该邮箱已注册');

    const usernameTaken = await prisma.user.findUnique({ where: { username: input.username } });
    if (usernameTaken) throw appError('USERNAME_TAKEN', '用户名已被占用');

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        email,
        username: input.username,
        passwordHash,
        role: 'STUDENT',
        avatarColor: pickColor(),
        student: {
          create: {
            eduEmail: email,
            school: input.school,
            college: input.college,
            major: input.major,
            grade: input.grade,
            verifyStatus: 'VERIFIED',
            verifiedAt: new Date(),
          },
        },
      },
      include: { student: true, creator: true },
    });

    return {
      userId: user.id,
      role: user.role,
      creatorProfileId: undefined,
      pwdVersion: user.pwdVersion,
    };
  },

  /** 登录（防枚举统一文案；封号拦截） */
  async login(input: LoginInput) {
    const email = input.email.toLowerCase();
    await enforceRateLimit(`rl:login:${email}`, RL_LOGIN_PER_MIN, 60_000);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { creator: true },
    });
    if (!user) throw appError('INVALID_CREDENTIAL', '邮箱或密码错误');

    const ok = await verifyPassword(
      input.password,
      user.passwordHash,
      user.passwordPepper ?? undefined,
    );
    if (!ok) throw appError('INVALID_CREDENTIAL', '邮箱或密码错误');

    if (user.status === 'BANNED') {
      throw appError(
        'FORBIDDEN',
        user.bannedReason ? `账号已被封禁：${user.bannedReason}` : '账号已被封禁',
      );
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await cacheDel(meKey(user.id)); // 登录后返回聚合数据前先失效，保证最新

    return {
      userId: user.id,
      role: user.role,
      creatorProfileId: user.creator?.id,
      pwdVersion: user.pwdVersion,
    };
  },

  /** 忘记密码（发重置码）：防枚举——未注册邮箱同样返回 ok 但不存码不发信 */
  async forgotPassword(email: string) {
    if (!isEduEmail(email)) throw appError('NOT_EDU', '请使用深圳大学教育邮箱');
    await enforceRateLimit(`rl:reset:${email.toLowerCase()}`, RL_RESET_PER_HOUR, 3600_000);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { ok: true }; // 防枚举：与已注册邮箱行为一致

    const code = generateCode();
    await saveCode(email, code, 'reset');
    await sendResetCode(email, code);
    return { ok: true };
  },

  /** 重置密码（消费 reset 码 → 新哈希 + pwdVersion++ → 全端会话失效） */
  async resetPassword(input: ResetPasswordInput) {
    const email = input.email.toLowerCase();
    // 防 6 位码爆破：consumeCode 错码不删 key，必须限制尝试次数
    await enforceRateLimit(`rl:reset-try:${email}`, RL_RESET_TRY_PER_HOUR, 3600_000);
    await consumeCode(email, input.code, 'reset');

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw appError('NOT_FOUND', '用户不存在');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(input.newPassword),
        pwdVersion: { increment: 1 }, // 原子自增，多副本无竞态
      },
    });
    await Promise.all([cacheDel(userStatusKey(user.id)), cacheDel(meKey(user.id))]);
    return { ok: true };
  },

  /** 登录后改密码（旧密码验证 → 同样 pwdVersion++ 踢全端） */
  async changePassword(userId: string, input: ChangePasswordInput) {
    await enforceRateLimit(`rl:pwd:${userId}`, RL_PWD_PER_MIN, 60_000);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw appError('NOT_FOUND', '用户不存在');

    const ok = await verifyPassword(
      input.oldPassword,
      user.passwordHash,
      user.passwordPepper ?? undefined,
    );
    if (!ok) throw appError('WRONG_OLD_PASSWORD', '旧密码错误');

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(input.newPassword),
        pwdVersion: { increment: 1 },
      },
    });
    await Promise.all([cacheDel(userStatusKey(userId)), cacheDel(meKey(userId))]);
    return { ok: true }; // 当前 JWT 的 pwdVer 已过期 → 下个请求 401 → 前端引导重新登录
  },

  /** 申请创作者（未认证状态，等管理员审核） */
  async applyCreator(userId: string, input: CreatorApplyInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { creator: true },
    });
    if (!user) throw appError('NOT_FOUND', '用户不存在');
    if (user.creator) throw appError('ALREADY_CREATOR', '已是创作者');

    const creator = await prisma.creatorProfile.create({
      data: {
        userId,
        bio: input.bio,
        direction: input.direction,
        honor: input.honor ?? null,
        verified: false,
        appliedAt: new Date(),
        wallet: { create: { balance: 0, pending: 0, withdrawn: 0 } },
      },
    });
    await cacheDel(meKey(userId));

    return creator;
  },
};

const AVATAR_COLORS = ['#FF6B4A', '#A855F7', '#10B981', '#E8638F', '#6366F1', '#F59E0B'];

function pickColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}
