import { test, expect } from '@playwright/test';

// E2E 冒烟：覆盖核心路径（完整 7 条路径见 docs/VERSION2.md V2-6）。
// 前置：docker compose up -d（PG/Redis/MinIO）+ pnpm db:seed + pnpm dev（webServer 自动起）。

test.describe('核心路径冒烟', () => {
  test('登录 → 跳回首页', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'demo@szu.edu.cn');
    await page.fill('input[type="password"]', 'demo1234');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/');
    await expect(page.getByText('今日免费推荐')).toBeVisible();
  });

  test('首页 → 作品详情', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('今日免费推荐')).toBeVisible();
    await page.goto('/work/w_db1');
    await expect(page.getByText('数据库期末押题')).toBeVisible();
    await expect(page.getByText('资料预览')).toBeVisible();
  });

  test('搜索 → 结果', async ({ page }) => {
    await page.goto('/search?q=%E6%95%B0%E6%8D%AE%E5%BA%93');
    await expect(page.getByText('搜索「数据库」')).toBeVisible();
  });
});
