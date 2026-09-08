// V10 主页/explore 渲染级验收脚本(结构断言 + 控制台/请求错误 + 移动端溢出)
// 用法: node scripts/verify-v10.mjs   (BASE_URL 环境变量可覆盖,默认本地 dev)
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const errors = [];
const check = (name, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗ FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) errors.push(name);
};

const browser = await chromium.launch();
async function audit(url, viewport) {
  const page = await browser.newPage({ viewport });
  const consoleErrs = [];
  const failedReqs = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // 未登录时 /auth/me 401 是 useAuth 的预期探测,不计为失败(console 文本不带 URL,看 location)
    const loc = m.location()?.url ?? '';
    if (loc.includes('/api/v1/auth/me')) return;
    if (m.text().includes('401')) return;
    consoleErrs.push(m.text().slice(0, 160));
  });
  // 未登录时 /auth/me 401 是 useAuth 的预期探测,不计为失败
  page.on('response', (r) => r.status() >= 400 && !(r.status() === 401 && r.url().includes('/auth/me')) && failedReqs.push(`${r.status()} ${r.url().slice(0, 120)}`));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  return { page, consoleErrs, failedReqs };
}

// ---- 桌面 主页 ----
{
  const { page, consoleErrs, failedReqs } = await audit(BASE, { width: 1440, height: 1000 });
  check('刊头标题', (await page.textContent('.blog-mast h1'))?.includes('找资料'));
  const chips = await page.locator('.bc-chip').count();
  check('分类行 chips = 1全部+7类', chips === 8, `got ${chips}`);
  check('总收录数渲染', /共收录资料 \d+ 份/.test(await page.textContent('.blog-mast-side') ?? ''));
  check('新生特辑块', (await page.locator('.fresh-zone').count()) === 1);
  const frows = await page.locator('.f-row').count();
  check('特辑精选行 ≥1', frows >= 1, `got ${frows}`);
  check('特辑 chips', (await page.locator('.fchip').count()) >= 1);
  check('hero 首条', (await page.locator('.hero-post').count()) === 1);
  const feed = await page.locator('.feed-row').count();
  check('时间流行 ≥1', feed >= 1, `got ${feed}`);
  check('hero 链接有效', (await page.getAttribute('.hero-post a', 'href'))?.startsWith('/work/'));
  const rec = await page.locator('.rec-row').count();
  check('编辑推荐行 ≥1', rec >= 1, `got ${rec}`);
  const rm = await page.locator('.rm-row').count();
  check('路线图行 ≥1', rm >= 1, `got ${rm}`);
  const boxes = await page.locator('.blog-side .side-box').count();
  check('侧栏 3 盒(排行/公告/分类)', boxes === 3, `got ${boxes}`);
  check('排行榜 4 tab', (await page.locator('.side-tab').count()) === 4);
  check('排行行 ≥1', (await page.locator('.sr-row').count()) >= 1);
  const catRows = await page.locator('.cat-row').count();
  check('侧栏分类 7 行', catRows === 7, `got ${catRows}`);
  // 点第一个 feed-row 进详情
  await page.locator('.feed-row').first().click();
  await page.waitForURL('**/work/**', { timeout: 8000 });
  check('目录行可进详情', page.url().includes('/work/'), page.url().slice(0, 60));
  // 排行榜 tab 切换
  await page.goBack();
  await page.waitForSelector('.side-tab', { timeout: 8000 });
  await page.locator('.side-tab').nth(1).click();
  await page.waitForTimeout(800);
  check('排行 tab 切换有数据', (await page.locator('.sr-row').count()) >= 1);
  check('主页无控制台错误', consoleErrs.length === 0, consoleErrs[0] ?? '');
  check('主页无 4xx/5xx 请求', failedReqs.length === 0, failedReqs.slice(0, 2).join(' | '));
  await page.close();
}

// ---- 桌面 explore ----
{
  const { page, consoleErrs, failedReqs } = await audit(`${BASE}/explore?cat=CAMPUS`, { width: 1440, height: 1000 });
  const feed = await page.locator('.feed-row').count();
  check('explore 目录行 ≥1', feed >= 1, `got ${feed}`);
  check('explore 无旧卡片', (await page.locator('.card-grid').count()) === 0);
  check('explore 筛选标签区在', (await page.locator('.explore-filters').count()) === 1);
  await page.locator('.feed-row').first().click();
  await page.waitForURL('**/work/**', { timeout: 8000 });
  check('explore 行可进详情', page.url().includes('/work/'));
  check('explore 无控制台错误', consoleErrs.length === 0, consoleErrs[0] ?? '');
  check('explore 无 4xx/5xx 请求', failedReqs.length === 0, failedReqs.slice(0, 2).join(' | '));
  await page.close();
}

// ---- 移动端 375px 溢出检查 ----
for (const path of ['/', '/explore']) {
  const { page } = await audit(`${BASE}${path}`, { width: 375, height: 812 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`移动端 ${path} 无横向溢出`, overflow <= 0, `overflow ${overflow}px`);
  await page.close();
}

// ---- 旧外链 ?zone=growth 不报错 ----
{
  const { page, failedReqs } = await audit(`${BASE}/?zone=growth`, { width: 1440, height: 900 });
  check('?zone=growth 兼容渲染', (await page.locator('.blog-mast').count()) === 1 && failedReqs.length === 0);
  await page.close();
}

await browser.close();
console.log(errors.length ? `\n== ${errors.length} 项失败 ==` : '\n== 全部通过 ==');
process.exit(errors.length ? 1 : 0);
