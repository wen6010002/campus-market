import { describe, it, expect } from 'vitest';
import { SignJWT, jwtVerify } from 'jose';
import { isEduEmail, generateCode } from '@/server/auth/verify-code';
import { hashPassword, verifyPassword, isValidPassword } from '@/server/auth/password';
import { hasPermission } from '@/server/auth/rbac';
import { signSession, verifySession } from '@/server/auth/session';

describe('edu 邮箱正则（V5：仅深大，任意级子域）', () => {
  it('接受 szu.edu.cn 及其子域', () => {
    expect(isEduEmail('a@szu.edu.cn')).toBe(true);
    expect(isEduEmail('2024150187@mails.szu.edu.cn')).toBe(true);
    expect(isEduEmail('a@mail.szu.edu.cn')).toBe(true);
    expect(isEduEmail('a@x.y.szu.edu.cn')).toBe(true);
  });
  it('接受深大企微邮箱 szdx.wecom.work（2024 级及以后新生）', () => {
    expect(isEduEmail('zhuangyuqing@szdx.wecom.work')).toBe(true);
  });
  it('拒绝非深大域名与伪装', () => {
    expect(isEduEmail('x@edu.cn')).toBe(false); // V5 行为变更：旧正则放行
    expect(isEduEmail('b@tsinghua.edu.cn')).toBe(false); // V5 行为变更：外校 edu 不再放行
    expect(isEduEmail('a@gmail.com')).toBe(false);
    expect(isEduEmail('a@163.com')).toBe(false);
    expect(isEduEmail('a@163.edu.com')).toBe(false);
    expect(isEduEmail('a@xszu.edu.cn')).toBe(false); // 后缀伪装
    expect(isEduEmail('a@szu.edu.cn.com')).toBe(false); // 后缀伪装
    expect(isEduEmail('a@wecom.work')).toBe(false); // 企微裸域（任意企业可注册）
    expect(isEduEmail('a@othercorp.wecom.work')).toBe(false); // 其他企业的企微邮箱
    expect(isEduEmail('a@fake-szdx.wecom.work')).toBe(false); // 前缀伪装
    expect(isEduEmail('a@szdx.wecom.work.com')).toBe(false); // 后缀伪装
  });
});

describe('密码强度与哈希', () => {
  it('强度校验：≥8 位且含字母数字', () => {
    expect(isValidPassword('abc12345')).toBe(true);
    expect(isValidPassword('abcdefgh')).toBe(false);
    expect(isValidPassword('12345678')).toBe(false);
    expect(isValidPassword('short1')).toBe(false);
  });
  it('bcrypt(密码+pepper) 往返', async () => {
    const h = await hashPassword('demo1234', 'pepper');
    expect(await verifyPassword('demo1234', h, 'pepper')).toBe(true);
    expect(await verifyPassword('wrong', h, 'pepper')).toBe(false);
    expect(await verifyPassword('demo1234', h, 'other-pepper')).toBe(false);
  });
});

describe('验证码生成', () => {
  it('始终为 6 位数字', () => {
    for (let i = 0; i < 20; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });
});

describe('JWT 会话', () => {
  it('签名/验签往返（含 role、creatorProfileId 与 pwdVer）', async () => {
    const token = await signSession({
      userId: 'u1',
      role: 'CREATOR',
      creatorProfileId: 'cp1',
      pwdVer: 2,
    });
    const s = await verifySession(token);
    expect(s).toMatchObject({ userId: 'u1', role: 'CREATOR', creatorProfileId: 'cp1', pwdVer: 2 });
  });
  it('无效/篡改 token 返回 null', async () => {
    expect(await verifySession('garbage.token.here')).toBeNull();
  });
  it('V5 之前的 JWT 无 pwdVer claim → 视为 0（存量会话不误踢）', async () => {
    const secret = new TextEncoder().encode(
      process.env.AUTH_SECRET ?? 'dev-secret-32-bytes-minimum-length',
    );
    const oldToken = await new SignJWT({ role: 'STUDENT' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u1')
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);
    const { payload } = await jwtVerify(oldToken, secret); // 确认 claim 确实缺失
    expect(payload.pwdVer).toBeUndefined();
    expect(await verifySession(oldToken)).toMatchObject({ userId: 'u1', pwdVer: 0 });
  });
});

describe('权限矩阵', () => {
  it('上传开放给所有登录角色（V3-2 开放发布）', () => {
    expect(hasPermission('STUDENT', 'upload')).toBe(true);
    expect(hasPermission('CREATOR', 'upload')).toBe(true);
    expect(hasPermission('ADMIN', 'upload')).toBe(true);
  });
  it('审核仅管理员', () => {
    expect(hasPermission('CREATOR', 'audit')).toBe(false);
    expect(hasPermission('ADMIN', 'audit')).toBe(true);
  });
  it('评分/购买/收藏 所有角色可', () => {
    for (const a of ['rate', 'buy', 'favorite', 'follow', 'like', 'download'] as const) {
      expect(hasPermission('STUDENT', a)).toBe(true);
      expect(hasPermission('CREATOR', a)).toBe(true);
      expect(hasPermission('ADMIN', a)).toBe(true);
    }
  });
});
