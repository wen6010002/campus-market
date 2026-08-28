import { describe, it, expect } from 'vitest';
import { isEduEmail, generateCode } from '@/server/auth/verify-code';
import { hashPassword, verifyPassword, isValidPassword } from '@/server/auth/password';
import { hasPermission } from '@/server/auth/rbac';
import { signSession, verifySession } from '@/server/auth/session';

describe('edu 邮箱正则', () => {
  it('接受 .edu.cn 域名（契约正则：至多一级子域名）', () => {
    expect(isEduEmail('a@szu.edu.cn')).toBe(true);
    expect(isEduEmail('b@tsinghua.edu.cn')).toBe(true);
    expect(isEduEmail('x@edu.cn')).toBe(true);
  });
  it('拒绝非 edu 邮箱', () => {
    expect(isEduEmail('a@gmail.com')).toBe(false);
    expect(isEduEmail('a@szu.com')).toBe(false);
    expect(isEduEmail('a@163.edu.com')).toBe(false);
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
  it('签名/验签往返（含 role 与 creatorProfileId）', async () => {
    const token = await signSession({ userId: 'u1', role: 'CREATOR', creatorProfileId: 'cp1' });
    const s = await verifySession(token);
    expect(s).toMatchObject({ userId: 'u1', role: 'CREATOR', creatorProfileId: 'cp1' });
  });
  it('无效/篡改 token 返回 null', async () => {
    expect(await verifySession('garbage.token.here')).toBeNull();
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
