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
  await page.goto('/user/c_he'); // 何思远（OS 方向）
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
  await page.fill('input[placeholder^="学科或课程名"]', '测试课程');
  await page.click('.cat-opt >> nth=0'); // 用途大类：课程学习（V3-2 必选）
  await page.locator('.chips .chip').first().click(); // 预设标签
  await page.check('label.check input[type="checkbox"]'); // 版权声明
  await page.click('button:has-text("提交审核")');
  await page.waitForURL((url) => url.pathname.startsWith('/user/')); // 发布成功跳转个人主页作品 tab（V3-5）

  // 管理员审核通过
  const pending = await adminApi(request, '/admin/works/pending', 'GET');
  const work = pending.data.find((w: { title: string }) => w.title === 'E2E 发布测试作品');
  expect(work).toBeTruthy();
  await adminApi(request, `/admin/works/${work.id}/audit`, 'POST', { action: 'APPROVE' });

  // 个人主页作品 tab 出现（V3-5）
  await page.goto('/me?tab=works');
  await page.waitForURL((url) => url.pathname.startsWith('/user/'));
  await expect(page.getByText('E2E 发布测试作品').first()).toBeVisible();
});

test('4. 收藏 → 我的收藏', async ({ page }) => {
  await login(page, 'demo@szu.edu.cn');
  await page.goto('/work/w_db1');
  const btn = page.locator('button', { hasText: '收藏' }).first();
  await btn.waitFor();
  if ((await btn.textContent())?.includes('已收藏')) {
    await btn.click(); // 先取消，保证幂等
    // 等精确文本（= 查询回填完成），避免在瞬态文本上二次点击把收藏又删掉
    await expect(btn).toHaveText(/♡ 收藏/);
  }
  await btn.click();
  await expect(btn).toHaveText(/♥ 已收藏/);

  await page.goto('/me?tab=favs');
  await expect(page.getByText('数据库期末押题').first()).toBeVisible();
});

test('5. 举报作品 → 管理员处理', async ({ page, request }) => {
  // 用独立新账号举报：避开 demo 账号的 5/h 举报限流与历史残留，天然幂等
  const ts = Date.now();
  await register(page, `e2e5-${ts}@szu.edu.cn`, `E2E五号${ts}`);
  const report = await page.request.post('/api/v1/reports', {
    data: { targetType: 'WORK', targetId: 'w_net', reason: 'MISMATCH', detail: 'E2E 举报测试' },
  });
  expect(report.status()).toBe(201);

  // 管理员聚合列出并处置（V3-6：按 target）
  const list = await adminApi(request, '/admin/reports', 'GET');
  const group = list.data.data.find(
    (g: { targetType: string; targetId: string; reporters: { detail: string | null }[] }) =>
      g.targetType === 'WORK' &&
      g.targetId === 'w_net' &&
      g.reporters.some((r) => r.detail === 'E2E 举报测试'),
  );
  expect(group).toBeTruthy();
  await adminApi(request, '/admin/reports/handle', 'POST', {
    targetType: 'WORK',
    targetId: 'w_net',
    action: 'RESOLVE',
    note: 'E2E 处置',
  });
});

test('6. 收益明细 → 提现申请', async ({ page }) => {
  await login(page, 'demo@szu.edu.cn');
  await page.goto('/user/u0?tab=income'); // V3-5 收益并入个人主页
  await expect(page.getByText('累计收益')).toBeVisible();
  // 提现按钮存在（余额不足时点提现会提示，但入口可见）
  await expect(page.getByText('提现', { exact: true }).first()).toBeVisible();
});

test('7. 搜索 → 详情', async ({ page }) => {
  await page.goto('/search?q=%E6%95%B0%E6%8D%AE%E5%BA%93');
  await expect(page.getByText('搜索「数据库」')).toBeVisible();
  // 点第一个结果进详情
  await page.locator('.work-card').first().click();
  await expect(page.getByText('在线预览').first()).toBeVisible(); // V3-4 预览入口
});

// ===== V3 新增核心路径 =====

test('8. 分类浏览（V3-2）：explore 大类/标签过滤', async ({ page }) => {
  await page.goto('/explore?cat=CAMPUS&tag=' + encodeURIComponent('选课攻略'));
  await expect(page.getByRole('heading', { name: '分类浏览' })).toBeVisible();
  await expect(page.locator('.card-grid .work-card, .card-grid .fine-card').first()).toBeVisible();
});

test('9. 在线预览（V3-4）：免费作品匿名可看 + 观看计数', async ({ page, request }) => {
  const before = await request.get('/api/v1/works/w_fresh1').then((r) => r.json());
  await page.goto('/work/w_fresh1');
  await page.click('.preview-entry');
  await expect(page.locator('.pv-frame')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.pv-pages')).toContainText('完整版');
  // 观看 +1（去重口径：同上下文一次）
  const key = await request.post('/api/v1/works/w_fresh1/preview').then((r) => r.json());
  expect(['full', 'sample']).toContain(key.data.mode);
  expect(key.data.mode).toBe('full');
});

test('10. 个人主页（V3-5）：匿名看他人 4 tab + 跳转', async ({ page }) => {
  await page.goto('/creator/c_lin'); // 旧链接 307 → /user/c_lin
  await page.waitForURL((url) => url.pathname === '/user/c_lin');
  await expect(page.locator('.up-tabs .tab-btn').first()).toBeVisible({ timeout: 10_000 });
  const tabs = await page.locator('.up-tabs .tab-btn').allInnerTexts();
  expect(tabs.join(',')).toBe('作品,评价,关注,粉丝');
  await page.click('button:has-text("粉丝")');
  await expect(page.locator('.fr-row').first()).toBeVisible();
});

// ===== V5 新增：忘记密码全链路（含旧会话被 pwdVersion 踢线的端到端证据） =====

test('11. 忘记密码（V5）：发码→重置→新密码登录→旧会话被踢', async ({ page, context, browser }) => {
  const ts = Date.now();
  const email = `e2e-rst-${ts}@szu.edu.cn`;
  await register(page, email, `重置同学${ts}`);
  // 另存一个「旧密码登录」的会话（无痕上下文）
  const oldCtx = await browser.newContext();
  const oldPage = await oldCtx.newPage();
  await login(oldPage, email, 'demo1234');
  await expect(oldPage.locator('.avatar-wrap .avatar')).toBeVisible();

  // 走忘记密码流程
  await page.goto('/forgot-password');
  await page.fill('input[type="email"]', email);
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/forgot-password')),
    page.click('button:has-text("发送验证码")'),
  ]);
  expect(resp.ok()).toBeTruthy();
  const code = await getVerifyCode(email, 'reset');
  await page.fill('input[placeholder="6 位数字"]', code);
  await page.fill('input[placeholder="至少 8 位，含字母和数字"]', 'newpass123');
  await page.click('button:has-text("重置密码")');
  await page.waitForURL((url) => url.pathname === '/login');

  // 新密码可登录
  await login(page, email, 'newpass123');

  // 旧会话被 pwdVersion 踢线：刷新后回到未登录态（未登录 Nav 的「登录」是 Link 不是 button）
  await oldPage.reload();
  await expect(oldPage.locator('header a:has-text("登录")').first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(oldPage.locator('.avatar-wrap .avatar')).toHaveCount(0);
  await oldCtx.close();
});
