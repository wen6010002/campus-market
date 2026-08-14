import { test, expect } from '@playwright/test';
import { login, register, adminApi, rateWork, getVerifyCode } from './helpers';

// E2E 7 条核心路径（BACKEND.md §12.4）。
// 前置：docker compose up -d（PG/Redis/MinIO/mailhog）+ pnpm db:seed + PAYMENT_MODE=mock。

test.describe.configure({ mode: 'serial', timeout: 120_000 });

test('1. 注册→登录→购买(mock)→评分→评价出现', async ({ page }) => {
  const ts = Date.now();
  const email = `e2e1-${ts}@szu.edu.cn`;
  await register(page, email, `E2E一号${ts}`);

  // 首页 → 点付费作品详情
  await page.goto('/work/w_agentpro');
  await expect(page.getByRole('heading', { name: /AI Agent 项目实战/ })).toBeVisible();

  // 购买（mock 立即成功）
  await page.click('button:has-text("立即购买")');
  await page.click('button:has-text("立即支付")');
  await expect(page.getByText('购买成功')).toBeVisible();

  // 评分（购买后获得 myAccess）
  await rateWork(page);
});

test('2. 关注创作者 → 动态流出现', async ({ page }) => {
  await login(page, 'demo@szu.edu.cn');
  await page.goto('/creator/c_he'); // 何思远（OS 方向）
  const btn = page.locator('button', { hasText: '关注' }).first();
  await btn.waitFor();
  if ((await btn.textContent())?.includes('已关注')) {
    await btn.click(); // 先取消，保证幂等
    await expect(btn).toContainText('关注 TA');
  }
  await btn.click();
  await expect(btn).toContainText('已关注');

  await page.goto('/following');
  await expect(page.getByRole('heading', { name: '关注动态' })).toBeVisible();
});

test('3. 创作者发布 → 审核通过 → 我的作品出现', async ({ page, request }) => {
  await login(page, 'demo@szu.edu.cn');
  await page.goto('/upload');

  await page.setInputFiles('input[type="file"]', {
    name: 'e2e.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(`%PDF-1.4 E2E test file ${Date.now()}`),
  });
  await page.fill('input[placeholder="作品标题（≤120 字）"]', 'E2E 发布测试作品');
  await page.fill('textarea', 'E2E 发布测试描述');
  await page.fill('input[placeholder="如：数据库原理"]', '测试课程');
  await page.check('input[type="checkbox"]');
  await page.click('button:has-text("提交审核")');
  await page.waitForURL((url) => url.pathname === '/creator-center'); // 发布成功跳转创作者中心

  // 管理员审核通过
  const pending = await adminApi(request, '/admin/works/pending', 'GET');
  const work = pending.data.find((w: { title: string }) => w.title === 'E2E 发布测试作品');
  expect(work).toBeTruthy();
  await adminApi(request, `/admin/works/${work.id}/audit`, 'POST', { action: 'APPROVE' });

  // 我的作品出现
  await page.goto('/creator-center');
  await page.click('button:has-text("我的作品")');
  await expect(page.getByText('E2E 发布测试作品').first()).toBeVisible();
});

test('4. 收藏 → 我的收藏', async ({ page }) => {
  await login(page, 'demo@szu.edu.cn');
  await page.goto('/work/w_db1');
  const btn = page.locator('button', { hasText: '收藏' }).first();
  await btn.waitFor();
  if ((await btn.textContent())?.includes('已收藏')) {
    await btn.click(); // 先取消，保证幂等
    await expect(btn).toContainText('收藏');
  }
  await btn.click();
  await expect(btn).toContainText('已收藏');

  await page.goto('/me?tab=favs');
  await expect(page.getByText('数据库期末押题').first()).toBeVisible();
});

test('5. 举报作品 → 管理员处理', async ({ page, request }) => {
  await login(page, 'demo@szu.edu.cn');
  // 用 API 举报（详情页举报 UI 后续补）
  const report = await page.request.post('/api/v1/reports', {
    data: { targetType: 'WORK', targetId: 'w_net', reason: 'MISMATCH', detail: 'E2E 举报测试' },
  });
  expect(report.ok()).toBeTruthy();

  // 管理员列出并处置
  const list = await adminApi(request, '/admin/reports', 'GET');
  const item = list.data.find((r: { detail: string }) => r.detail === 'E2E 举报测试');
  expect(item).toBeTruthy();
  await adminApi(request, `/admin/reports/${item.id}`, 'POST', { status: 'RESOLVED' });
});

test('6. 收益明细 → 提现申请', async ({ page }) => {
  await login(page, 'demo@szu.edu.cn');
  await page.goto('/income');
  await expect(page.getByText('我的收益')).toBeVisible();
  await expect(page.getByText('累计收益')).toBeVisible();
  // 提现按钮存在（余额不足时点提现会提示，但入口可见）
  await expect(page.getByText('提现', { exact: true }).first()).toBeVisible();
});

test('7. 搜索 → 详情', async ({ page }) => {
  await page.goto('/search?q=%E6%95%B0%E6%8D%AE%E5%BA%93');
  await expect(page.getByText('搜索「数据库」')).toBeVisible();
  // 点第一个结果进详情
  await page.locator('.work-card').first().click();
  await expect(page.getByText('资料预览')).toBeVisible();
});
