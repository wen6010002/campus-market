#!/usr/bin/env node
// Campus Market 接口压测（零依赖，Node ≥ 18）。
//
// 用法：
//   node scripts/stress.mjs --base http://154.222.19.224 --vu 40 --dur 60 --mix mixed
//   node scripts/stress.mjs --base http://127.0.0.1:3000 --vu 8  --dur 30 --mix login
//
// mix：
//   read   只打公开读接口（无需登录）
//   mixed  读为主 + 登录态读 + 受限写的综合负载（默认，最接近真实流量）
//   write  写为主（打卡/收藏/点赞，按每用户限流自动配速）
//   login  登录专项（bcrypt 成本探测，按邮箱限流 10/min 自动配速）
//
// 压测账号由 scripts/stress-users.ts 创建（stress001@szu.edu.cn / Stress1234）。

import http from 'node:http';
import { parseArgs } from 'node:util';

const { values: arg } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://127.0.0.1:3000' },
    vu: { type: 'string', default: '40' },
    dur: { type: 'string', default: '60' },
    mix: { type: 'string', default: 'mixed' },
    accounts: { type: 'string', default: '60' },
    out: { type: 'string', default: '' },
  },
});

const BASE = arg.base.replace(/\/$/, '');
const VU = Number(arg.vu);
const DUR_S = Number(arg.dur);
const MIX = arg.mix;
const ACCOUNTS = Number(arg.accounts);
const PASSWORD = 'Stress1234';
const COOKIE_NAME = 'cm_token';

const agent = new http.Agent({ keepAlive: true, maxSockets: 1024, keepAliveMsecs: 30_000 });
const u = (path) => new URL(path, BASE);

// ---------- HTTP ----------
function request(method, path, { cookie, body } = {}) {
  return new Promise((resolve) => {
    const url = u(path);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method,
        agent,
        headers: {
          ...(payload && { 'content-type': 'application/json' }),
          ...(cookie && { cookie }),
          accept: 'application/json',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {}
          resolve({ status: res.statusCode, json, headers: res.headers });
        });
      },
    );
    req.on('error', (err) => resolve({ status: 0, error: err.code || err.message }));
    if (payload) req.write(payload);
    req.end();
  });
}

// ---------- 场景 ----------
// ctx 在发现阶段填充真实 id；minInterval 为同一 VU 两次该场景的最小间隔（适配服务端限流）。
const ctx = { workId: '', roadmapId: '', stepIds: [], userId: 'u0', term: 'Java' };

const SCENARIOS = {
  health: { mix: ['read', 'mixed'], w: 2, run: () => ({ m: 'GET', p: '/api/health' }) },
  works: {
    mix: ['read', 'mixed'],
    w: 10,
    run: (vu) => ({ m: 'GET', p: `/api/v1/works?page=${(vu.n % 5) + 1}&pageSize=12` }),
  },
  workDetail: { mix: ['read', 'mixed'], w: 8, auth: false, run: () => ({ m: 'GET', p: `/api/v1/works/${ctx.workId}` }) },
  search: {
    mix: ['read', 'mixed'],
    w: 8,
    run: (vu) => ({ m: 'GET', p: `/api/v1/search?q=${encodeURIComponent(vu.terms[vu.n % vu.terms.length])}` }),
  },
  ranks: {
    mix: ['read', 'mixed'],
    w: 4,
    run: (vu) => ({ m: 'GET', p: `/api/v1/ranks/${['fav', 'help', 'creator'][vu.n % 3]}` }),
  },
  roadmaps: {
    mix: ['read', 'mixed'],
    w: 6,
    run: (vu) => ({ m: 'GET', p: `/api/v1/roadmaps?sort=${vu.n % 2 ? 'newest' : 'favs'}&page=${(vu.n % 2) + 1}` }),
  },
  roadmapDetail: { mix: ['read', 'mixed'], w: 6, run: () => ({ m: 'GET', p: `/api/v1/roadmaps/${ctx.roadmapId}` }) },
  announcements: { mix: ['read', 'mixed'], w: 3, run: () => ({ m: 'GET', p: '/api/v1/announcements' }) },
  userProfile: { mix: ['read', 'mixed'], w: 3, run: () => ({ m: 'GET', p: `/api/v1/users/${ctx.userId}` }) },
  // ---- 登录态读 ----
  me: { mix: ['mixed', 'auth'], w: 6, auth: true, run: () => ({ m: 'GET', p: '/api/v1/auth/me' }) },
  feed: { mix: ['mixed', 'auth'], w: 4, auth: true, run: () => ({ m: 'GET', p: '/api/v1/me/following/feed?page=1&pageSize=10' }) },
  progress: { mix: ['mixed', 'auth'], w: 4, auth: true, run: () => ({ m: 'GET', p: `/api/v1/roadmaps/${ctx.roadmapId}/progress` }) },
  myFavs: { mix: ['mixed', 'auth'], w: 3, auth: true, run: () => ({ m: 'GET', p: '/api/v1/me/roadmap-favorites' }) },
  notifications: { mix: ['mixed', 'auth'], w: 3, auth: true, run: () => ({ m: 'GET', p: '/api/v1/me/notifications' }) },
  // ---- 写（限流配速）----
  check: {
    mix: ['mixed', 'write'],
    w: 6,
    auth: true,
    minInterval: 1100, // 服务端 rl:check:${userId} 60/min
    run: (vu) => {
      const stepId = ctx.stepIds[vu.n % ctx.stepIds.length];
      const checked = vu.n % 4 < 2; // 2:2 勾/取消，数据量稳定
      return { m: 'POST', p: `/api/v1/roadmaps/${ctx.roadmapId}/check`, body: { stepId, checked } };
    },
  },
  workFav: {
    mix: ['mixed', 'write'],
    w: 3,
    auth: true,
    minInterval: 1000,
    run: (vu) => ({ m: vu.n % 2 ? 'DELETE' : 'POST', p: `/api/v1/works/${ctx.workId}/favorite` }),
  },
  workLike: {
    mix: ['mixed', 'write'],
    w: 3,
    auth: true,
    minInterval: 1000,
    run: (vu) => ({ m: vu.n % 2 ? 'DELETE' : 'POST', p: `/api/v1/works/${ctx.workId}/like` }),
  },
  login: {
    mix: ['login'],
    w: 10,
    auth: false,
    minInterval: 7000, // 服务端 rl:login:${email} 10/min
    run: (vu) => ({ m: 'POST', p: '/api/v1/auth/login', body: { email: vu.email, password: PASSWORD } }),
  },
};

// ---------- 统计 ----------
class Stats {
  constructor() {
    this.lat = [];
    this.status = new Map();
    this.errors = 0;
  }
  record(ms, status) {
    this.lat.push(ms);
    this.status.set(status, (this.status.get(status) ?? 0) + 1);
    if (status === 0 || status >= 500) this.errors++;
  }
  summary(rps) {
    const a = [...this.lat].sort((x, y) => x - y);
    const pick = (q) => (a.length ? a[Math.min(a.length - 1, Math.floor(q * a.length))] : 0);
    const avg = a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
    return {
      count: a.length,
      rps,
      avg: Math.round(avg),
      p50: Math.round(pick(0.5)),
      p90: Math.round(pick(0.9)),
      p99: Math.round(pick(0.99)),
      max: Math.round(a[a.length - 1] ?? 0),
      errors: this.errors,
      status: Object.fromEntries(this.status),
    };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => performance.now();

// ---------- 发现阶段：取真实业务 id ----------
async function discover() {
  const health = await request('GET', '/api/health');
  if (health.status !== 200) throw new Error(`健康检查失败：${health.status} ${JSON.stringify(health.json)}`);
  console.log(`✔ 健康检查通过（${BASE}）`);

  const works = await request('GET', '/api/v1/works?page=1&pageSize=5');
  const list = works.json?.data ?? [];
  if (!list.length) throw new Error('works 列表为空，无法发现 workId（先跑 seed）');
  ctx.workId = list[0].id;
  ctx.term = (list[0].title ?? 'Java').slice(0, 4);
  console.log(`✔ 发现作品 ${ctx.workId}（${list[0].title}），搜索词「${ctx.term}」`);

  const rms = await request('GET', '/api/v1/roadmaps');
  const rlist = rms.json?.data ?? [];
  if (!rlist.length) throw new Error('roadmaps 列表为空，无法发现 roadmapId（先跑 seed）');
  ctx.roadmapId = rlist[0].id;
  console.log(`✔ 发现路线图 ${ctx.roadmapId}（${rlist[0].title}）`);

  const detail = await request('GET', `/api/v1/roadmaps/${ctx.roadmapId}`);
  const phases = detail.json?.data?.content?.phases ?? [];
  ctx.stepIds = phases.flatMap((p) => p.steps.map((s) => s.id)).slice(0, 10);
  if (!ctx.stepIds.length) throw new Error('路线图无步骤');
  console.log(`✔ 发现 ${ctx.stepIds.length} 个可打卡步骤`);
}

async function loginVu(i) {
  const email = `stress${String((i % ACCOUNTS) + 1).padStart(3, '0')}@szu.edu.cn`;
  const res = await request('POST', '/api/v1/auth/login', { body: { email, password: PASSWORD } });
  if (res.status !== 200) throw new Error(`VU${i} 登录失败 ${res.status}: ${JSON.stringify(res.json)}`);
  const raw = (res.headers['set-cookie'] ?? []).join('; ');
  const token = raw.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))?.[1];
  if (!token) throw new Error(`VU${i} 登录成功但未拿到 ${COOKIE_NAME} cookie`);
  return { email, cookie: `${COOKIE_NAME}=${token}` };
}

// ---------- 主流程 ----------
async function main() {
  console.log(`\n=== Campus Market 压测 ===`);
  console.log(`目标 ${BASE} | VU=${VU} | 时长=${DUR_S}s | mix=${MIX}\n`);
  await discover();

  const active = Object.entries(SCENARIOS).filter(([, s]) => s.mix.includes(MIX));
  const totalW = active.reduce((s, [, s2]) => s + s2.w, 0);
  const needAuth = active.some(([, s]) => s.auth) || MIX === 'login';

  // 登录各 VU（错峰，避开 rl:login 每邮箱 10/min）
  const vus = [];
  if (needAuth) {
    console.log(`登录 ${VU} 个虚拟用户…`);
    for (let i = 0; i < VU; i++) {
      try {
        const { email, cookie } = await loginVu(i);
        vus.push({ i, n: 0, cookie, email, terms: [ctx.term, 'Java', 'Python', 'AI', '算法'], lastAt: {} });
      } catch (e) {
        console.error(`  ✘ ${e.message}`);
        throw e;
      }
      await sleep(150);
    }
    console.log(`✔ 全部登录成功\n`);
  } else {
    for (let i = 0; i < VU; i++)
      vus.push({ i, n: 0, cookie: null, email: null, terms: [ctx.term, 'Java', 'Python', 'AI', '算法'], lastAt: {} });
  }

  const pickScenario = (vu, t) => {
    for (let guard = 0; guard < 12; guard++) {
      let r = Math.random() * totalW;
      for (const [name, s] of active) {
        r -= s.w;
        if (r <= 0) {
          if (s.minInterval && t - (vu.lastAt[name] ?? -1e9) < s.minInterval) break; // 未到配速间隔，重选
          if (s.auth && !vu.cookie) break;
          vu.lastAt[name] = t;
          return [name, s];
        }
      }
    }
    // 全部被配速挡住时退回一个无限制场景
    const fallback = active.find(([n, s]) => !s.minInterval && (!s.auth || vu.cookie)) ?? active[0];
    return fallback;
  };

  const stats = new Map(active.map(([name]) => [name, new Stats()]));
  const deadline = now() + DUR_S * 1000;
  const startAt = Date.now();
  let stopAll = false;

  const worker = async (vu) => {
    while (!stopAll && now() < deadline) {
      const [name, s] = pickScenario(vu, now());
      const { m, p, body } = s.run(vu);
      vu.n++;
      const t0 = now();
      const res = await request(m, p, { cookie: vu.cookie, body });
      const dt = now() - t0;
      stats.get(name).record(dt, res.status);
      if (dt > 3000) process.stdout.write(`  ⚠ ${name} ${Math.round(dt)}ms status=${res.status}\n`);
    }
  };

  // 进度指示
  const timer = setInterval(() => {
    const done = active.reduce((s2, [n]) => s2 + stats.get(n).lat.length, 0);
    const el = ((now() - (deadline - DUR_S * 1000)) / 1000).toFixed(0);
    process.stdout.write(`\r  进行中 ${el}s / ${DUR_S}s，已完成 ${done} 请求   `);
  }, 2000);

  await Promise.all(vus.map(worker));
  clearInterval(timer);
  const elapsed = (Date.now() - startAt) / 1000;
  process.stdout.write('\n\n');

  // ---------- 报告 ----------
  const report = { base: BASE, mix: MIX, vu: VU, dur: DUR_S, elapsed, scenarios: {} };
  const rows = [];
  for (const [name] of active) {
    const st = stats.get(name);
    const sum = st.summary(st.lat.length / elapsed);
    report.scenarios[name] = sum;
    rows.push({ name, ...sum });
  }
  const totalReq = rows.reduce((s, r) => s + r.count, 0);
  const totalErr = rows.reduce((s, r) => s + r.errors, 0);
  report.total = { rps: totalReq / elapsed, requests: totalReq, errors: totalErr };

  const pad = (s, n) => String(s).padEnd(n);
  console.log(`${pad('场景', 14)}${pad('RPS', 8)}${pad('avg', 7)}${pad('p50', 7)}${pad('p90', 7)}${pad('p99', 7)}${pad('max', 8)}${pad('错误', 6)}状态码分布`);
  for (const r of rows.sort((a, b) => b.rps - a.rps)) {
    const sc = Object.entries(r.status).map(([k, v]) => `${k}×${v}`).join(' ');
    console.log(
      `${pad(r.name, 14)}${pad(r.rps.toFixed(1), 8)}${pad(r.avg + 'ms', 7)}${pad(r.p50 + 'ms', 7)}${pad(r.p90 + 'ms', 7)}${pad(r.p99 + 'ms', 7)}${pad(r.max + 'ms', 8)}${pad(r.errors, 6)}${sc}`,
    );
  }
  console.log(`\n合计：${totalReq} 请求 / ${elapsed.toFixed(1)}s = ${(totalReq / elapsed).toFixed(1)} RPS，错误 ${totalErr}（${((totalErr / totalReq) * 100).toFixed(2)}%）`);

  if (arg.out) {
    const { writeFileSync, mkdirSync } = await import('node:fs');
    mkdirSync('scripts/stress-results', { recursive: true });
    writeFileSync(arg.out, JSON.stringify(report, null, 2));
    console.log(`结果已写入 ${arg.out}`);
  }
  agent.destroy();
}

main().catch((e) => {
  console.error(`\n✘ ${e.message}`);
  process.exit(1);
});
