// 阶段 2 集成测试：注册/登录/会话/越权/封号/验证码/限流/创作者申请。
import { execSync } from 'node:child_process';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { prisma } from '@/server/db';
import { authService } from '@/server/services/auth.service';
import { consumeCode, saveCode } from '@/server/auth/verify-code';
import { flushDb } from '../helpers/flush';

const TEST_URL = process.env.DATABASE_URL_TEST!;

beforeAll(async () => {
  execSync('pnpm exec prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'ignore',
  });
  await flushDb(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const uniq = () => Math.random().toString(36).slice(2, 8);

async function registerUser(email: string, username: string) {
  await saveCode(email, '123456');
  return authService.register({
    email,
    code: '123456',
    username,
    password: 'demo1234',
    school: '深圳大学',
    college: '计软',
    major: '计算机',
    grade: '大二',
  });
}

describe('鉴权服务（阶段 2）', () => {
  it('注册：消费验证码建用户 + 学生档案（默认 STUDENT）', async () => {
    const email = `r-${uniq()}@szu.edu.cn`;
    const { userId, role } = await registerUser(email, '新同学');
    expect(role).toBe('STUDENT');
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { student: true },
    });
    expect(user.student?.school).toBe('深圳大学');
    expect(user.student?.verifyStatus).toBe('VERIFIED');
  });

  it('注册：邮箱已占用 → EMAIL_TAKEN', async () => {
    const email = `e-${uniq()}@szu.edu.cn`;
    await registerUser(email, '张三');
    await saveCode(email, '123456');
    await expect(
      authService.register({
        email,
        code: '123456',
        username: '张三二号',
        password: 'demo1234',
        school: '深圳大学',
        college: '计软',
        major: '计算机',
        grade: '大二',
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
  });

  it('注册：用户名占用 → USERNAME_TAKEN', async () => {
    await registerUser(`u1-${uniq()}@szu.edu.cn`, '重名同学');
    await expect(registerUser(`u2-${uniq()}@szu.edu.cn`, '重名同学')).rejects.toMatchObject({
      code: 'USERNAME_TAKEN',
    });
  });

  it('登录：正确密码成功、错误密码统一 INVALID_CREDENTIAL', async () => {
    const email = `l-${uniq()}@szu.edu.cn`;
    await registerUser(email, '登录用户');
    const ok = await authService.login({ email, password: 'demo1234' });
    expect(ok.userId).toBeTruthy();
    await expect(authService.login({ email, password: 'wrongpass1' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIAL',
    });
    await expect(
      authService.login({ email: 'ghost@szu.edu.cn', password: 'x123456' }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIAL',
    });
  });

  it('登录：封号用户 → FORBIDDEN', async () => {
    const email = `b-${uniq()}@szu.edu.cn`;
    const { userId } = await registerUser(email, '被封用户');
    await prisma.user.update({ where: { id: userId }, data: { status: 'BANNED' } });
    await expect(authService.login({ email, password: 'demo1234' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('验证码：未发送 → CODE_EXPIRED；错误 → CODE_INVALID', async () => {
    const email = `v-${uniq()}@szu.edu.cn`;
    await expect(consumeCode(email, '123456')).rejects.toMatchObject({ code: 'CODE_EXPIRED' });
    await saveCode(email, '654321');
    await expect(consumeCode(email, '111111')).rejects.toMatchObject({ code: 'CODE_INVALID' });
    await expect(consumeCode(email, '654321')).resolves.toBeUndefined();
  });

  it('发送验证码：非 edu → NOT_EDU；超限 → RATE_LIMITED', async () => {
    await expect(authService.sendCode('a@gmail.com')).rejects.toMatchObject({ code: 'NOT_EDU' });
    const email = `rl-${uniq()}@szu.edu.cn`;
    for (let i = 0; i < 5; i++) await authService.sendCode(email);
    await expect(authService.sendCode(email)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('创作者申请：STUDENT 可申请，重复申请 → ALREADY_CREATOR', async () => {
    const email = `c-${uniq()}@szu.edu.cn`;
    const { userId } = await registerUser(email, '准创作者');
    const creator = await authService.applyCreator(userId, { bio: '你好', direction: 'AI' });
    expect(creator.verified).toBe(false);
    await expect(
      authService.applyCreator(userId, { bio: '再申请', direction: 'AI' }),
    ).rejects.toMatchObject({
      code: 'ALREADY_CREATOR',
    });
  });
});
