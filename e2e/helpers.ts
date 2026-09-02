import { expect, type Page, type APIRequestContext } from '@playwright/test';
import IORedis from 'ioredis';

const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379');

/** 读验证码（测试环境直接读 Redis，避免收邮件；purpose 区分注册/重置，V5） */
export async function getVerifyCode(
  email: string,
  purpose: 'register' | 'reset' = 'register',
): Promise<string> {
  const code = await redis.get(`verify:${purpose}:email:${email.toLowerCase()}`);
  if (!code) throw new Error(`验证码不存在（${purpose}）：${email}`);
  return code;
}

/** 关掉登录公告弹窗（AnnounceGate：有未读公告会盖住整页，seed 库常有公告，不关会挡住后续点击） */
export async function dismissAnnounceIfOpen(page: Page) {
  const btn = page.locator('button:has-text("我知道了")');
  try {
    await btn.waitFor({ state: 'visible', timeout: 3000 });
    await btn.click();
    await page.waitForTimeout(300); // 等 mask 退场
  } catch {
    /* 未弹出则忽略 */
  }
}

/** UI 登录 */
export async function login(page: Page, email: string, password = 'demo1234') {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/login')),
    page.click('button:has-text("登录")'),
  ]);
  await page.waitForURL((url) => url.pathname === '/');
  await expect(page.locator('.avatar-wrap .avatar')).toBeVisible();
  await dismissAnnounceIfOpen(page);
}

/** UI 注册（自动从 Redis 读验证码） */
export async function register(page: Page, email: string, username: string) {
  await page.goto('/register');
  await page.fill('input[type="email"]', email);
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/send-code')),
    page.click('button:has-text("发送验证码")'),
  ]);
  expect(resp.ok()).toBeTruthy();
  const code = await getVerifyCode(email);
  await page.fill('input[placeholder="6 位数字"]', code);
  await page.fill('input[placeholder="2-30 字"]', username);
  await page.fill('input[type="password"]', 'demo1234');
  await page.fill('input[placeholder="计算机与软件学院"]', '计算机与软件学院');
  await page.fill('input[placeholder="计算机科学与技术"]', '计算机科学与技术');
  await page.fill('input[placeholder="如：大二"]', '大二');
  await page.click('button:has-text("注册")');
  await page.waitForURL((url) => url.pathname !== '/register');
  await dismissAnnounceIfOpen(page);
}

/** 管理员 API 操作（用 APIRequestContext 登录 admin 后调接口） */
export async function adminApi(
  request: APIRequestContext,
  path: string,
  method: 'GET' | 'POST' = 'POST',
  body?: unknown,
) {
  // 登录 admin 拿 cookie（request 上下文会保留 cookie）
  await request.post('/api/v1/auth/login', {
    data: { email: 'admin@szu.edu.cn', password: 'demo1234' },
  });
  const res = await request.fetch(`/api/v1${path}`, {
    method,
    data: body,
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

/** 作品详情页评分：等待 myAccess 后打开评分弹窗提交 */
export async function rateWork(page: Page, stars = 5) {
  // 点「写一个评价」按钮
  await page.click('button:has-text("写一个评价")');
  // 选星（第 stars 颗）
  await page
    .locator('.stars.clickable span')
    .nth(stars - 1)
    .click();
  await page.fill('textarea[placeholder*="至少 5 字"]', 'E2E 测试评价，内容很详细很有帮助');
  await page.click('button:has-text("提交评价")');
  await expect(page.getByText('E2E 测试评价').first()).toBeVisible();
}
