import { test, expect } from '@playwright/test';
import { register, login } from './helpers';

// V12 评论区 e2e：发布即显 → 回复 → 路线图评论 → 违禁词被拒 → 删除自己的。
// e2e 环境不跑 worker（异步 AI 审核由集成测试覆盖），同步闸（黑名单）在此验证。
test.describe.configure({ mode: 'serial', timeout: 120_000 });

test('V12 评论：资料页发布即显 + 回复 + 删除', async ({ page }) => {
  const ts = Date.now();
  await register(page, `e2e-cm-${ts}@szu.edu.cn`, `评论同学${ts}`);

  await page.goto('/work/w_fresh1');
  const section = page.locator('#comments');
  await section.scrollIntoViewIfNeeded();

  // 发布一级评论（先发后审：无 worker 环境保持可见）
  const marker = `E2E 评论 ${ts}`;
  await page.fill('#comments textarea', marker);
  await page.click('button:has-text("发布评论")');
  await expect(page.getByText('评论已发布')).toBeVisible();
  await expect(page.locator('.cm-content', { hasText: marker }).first()).toBeVisible();

  // 回复它（内联回复框，渲染在同 thread 的兄弟节点）
  const thread = page.locator('.cm-thread', { hasText: marker }).first();
  await thread.locator('.cm-ops button:has-text("回复")').click();
  await thread.locator('.cm-reply-box textarea').fill(`E2E 回复 ${ts}`);
  await thread.locator('.cm-reply-box button:has-text("回复")').click();
  await expect(page.locator('.cm-reply .cm-content', { hasText: `E2E 回复 ${ts}` })).toBeVisible();

  // 删除自己的一级评论（confirm 对话框需先注册处理器，否则 Playwright 默认拒绝）
  page.on('dialog', (d) => d.accept());
  await thread.locator('> .cm-item .cm-ops button.cm-danger').click();
  await page.waitForTimeout(400);
  await expect(page.locator('.cm-content', { hasText: marker })).toHaveCount(0);
});

test('V12 评论：路线图页可评论', async ({ page }) => {
  await login(page, 'demo@szu.edu.cn');
  await page.goto('/roadmaps/rm_backend');
  const section = page.locator('#comments');
  await section.scrollIntoViewIfNeeded();
  const marker = `路线图评论 ${Date.now()}`;
  await page.fill('#comments textarea', marker);
  await page.click('button:has-text("发布评论")');
  await expect(page.locator('.cm-content', { hasText: marker }).first()).toBeVisible();
});

test('V12 审核：黑名单词同步被拒（不依赖 worker）', async ({ page }) => {
  await login(page, 'demo@szu.edu.cn');
  await page.goto('/work/w_fresh1');
  await page.locator('#comments').scrollIntoViewIfNeeded();
  await page.fill('#comments textarea', '有没有人代考这门课');
  await page.click('button:has-text("发布评论")');
  await expect(page.getByText('评论包含违规内容，请修改后重发')).toBeVisible();
  // 未入库公开列表
  await expect(page.locator('.cm-content', { hasText: '代考' })).toHaveCount(0);
});

test('V12 打卡榜：页面可达', async ({ page }) => {
  await page.goto('/roadmaps/rank');
  await expect(page.getByRole('heading', { name: '连续打卡榜' })).toBeVisible();
});
