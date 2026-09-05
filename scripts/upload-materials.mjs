#!/usr/bin/env node
// 真实资料批量导入（2026-09-05 上线真实业务数据）。
// 服务器上跑（需 compose 网络：Redis 直连清 presign 限流 + 公网回环到 Caddy）：
//   docker run --rm --network docker_default --add-host kedahub.cn:154.222.19.224 \
//     -v /srv/campus-market/scripts:/scripts -v /srv/materials:/materials -w /app \
//     docker-migrate node /scripts/upload-materials.mjs
// 流程：admin 登录 → presign PUT 文件 → POST /works（DRAFT）→ 路线图直接 POST（ADMIN 直发）。
// 全部完成后用 SQL 把 admin 的 DRAFT 作品置 PUBLISHED（见脚本尾部输出提示）。
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import Redis from 'ioredis';

const BASE = 'https://kedahub.cn';
const ROOT = '/materials';
const ADMIN = { email: 'admin@szu.edu.cn', password: 'Kedahub2026' };
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

// ---------- HTTP ----------
let cookie = '';
async function api(method, path, body, raw = false) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body && !raw ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const m = c.match(/(cm_token=[^;]+)/);
    if (m) cookie = m[1];
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`);
  return json?.data ?? json;
}

// ---------- 分配表 ----------
const THEMES = ['g-default', 'g-java', 'g-net', 'g-ml', 'g-os', 'g-math', 'g-408', 'g-line', 'g-prob'];
let themeI = 0;

// 特例表：路径 → 元数据（覆盖目录默认规则）。fine=true 进首页精品展示位（依然免费下载）。
const SPECIAL = {
  // 新生/（校园引路为主，3 个按内容归考试/课程/留学）
  '资料/新生/大一新生开学准备清单.docx': { c: 'CAMPUS', i: '🎒', t: ['报到流程', '校园卡'], d: '从证件、床品到电子设备的一份开学全清单，照着打勾收拾行李即可。' },
  '资料/新生/大学生高含金量竞赛攻略.docx': { c: 'CAMPUS', i: '🏆', t: ['开学考试'], d: '数模、ACM、互联网+、挑战杯等高含金量竞赛的报名时间、门槛与备赛建议。' },
  '资料/新生/大学生实用考证攻略.docx': { c: 'CAMPUS', i: '📜', t: ['生活费攻略'], d: '四六级、计算机二级、教资、驾校等大学期间值得考的证书全梳理。' },
  '资料/新生/大学用英语自我介绍(共6篇).docx': { c: 'CAMPUS', i: '🗣', t: ['英语分级'], d: '开学英语分级考、社团面试、课堂展示都能用的 6 篇自我介绍模板。' },
  '资料/新生/大一新生如何参加大创项目.docx': { c: 'CAMPUS', i: '💡', t: ['选课攻略'], d: '大创（大学生创新创业训练计划）从组队、选题到立项申报的完整流程。' },
  '资料/新生/大一新生转专业申请书范文【三篇】.docx': { c: 'CAMPUS', i: '🔀', t: ['转专业'], d: '三篇转专业申请书范文，附写作要点，转专业窗口期前备好。' },
  '资料/新生/深大计软学院奖学金助学金评定制度汇总.docx': { c: 'CAMPUS', i: '🏫', t: ['校园卡'], d: '深大计软学院奖学金与助学金评定制度汇总，想拿奖学金先读懂规则。' },
  '资料/新生/生源地助学贷款申请流程.docx': { c: 'CAMPUS', i: '💰', t: ['生活费攻略'], d: '生源地信用助学贷款的申请材料、办理流程与还款说明。' },
  '资料/新生/马原考试题库1.doc': { c: 'COURSE', i: '📝', t: ['题库真题', '期末复习'], d: '马克思主义基本原理期末题库，刷题备考直接用。' },
  '资料/新生/英语四级整理笔记(1).doc': { c: 'EXAM', i: '📓', t: ['四级'], d: '四级高频词汇与语法要点整理笔记，考前速刷。' },
  '资料/新生/英语四六级：如何在短期内利用答题小技巧提分100+.docx': { c: 'EXAM', i: '⏫', t: ['四级', '六级'], d: '四六级短期提分的答题技巧合集，阅读听力写作各题型套路。' },
  '资料/新生/大一新生如何规划出国留学.docx': { c: 'ABROAD', i: '✈️', t: ['选校定位'], d: '大一开始规划留学的完整时间线：GPA、语言、科研与申请节奏。' },
  // 面试/
  '资料/面试/📋 通用面试题库60问.docx': { c: 'CAREER', i: '🎯', t: ['面试经验'], d: '实习校招通用面试题库 60 问，附答题框架，面试前过一遍。', fine: true },
  '资料/面试/面经大全.docx': { c: 'CAREER', i: '📚', t: ['面试经验', '校招攻略'], d: '各方向面试经验合集：技术面、HR 面、群面真实题目与复盘。', fine: true },
  // 冷启动资料/
  '资料/冷启动资料/03-大学路线选择.md': { c: 'LIFE', i: '🧭', t: ['方向选择'], d: '考研、保研、就业、留学四条路的决策框架：各自的门槛、时间线与适合人群。', fine: true },
  '资料/冷启动资料/04-程序员世界地图.md': { c: 'LIFE', i: '🗺', t: ['成长认知'], d: '前端、后端、算法、客户端……程序员各工种的技能树与协作关系全景图。' },
  '资料/冷启动资料/05-GitHub淘金地图.md': { c: 'LIFE', i: '⛏', t: ['技能学习'], d: '如何在 GitHub 上找优质项目、读源码、攒 Star 与贡献履历。' },
  '资料/冷启动资料/07-家教第一课.md': { c: 'TUTOR', i: '📖', t: ['家教经验'], d: '第一次做家教怎么备课、怎么开价、怎么和家长学生相处，全流程经验。' },
  '资料/冷启动资料/08-Java八股自查清单.md': { c: 'CAREER', i: '☕', t: ['面试经验', '校招攻略'], d: 'Java 校招高频八股自查清单，按主题分组，逐条过一遍查漏补缺。' },
  '资料/冷启动资料/09-计算机考研408指南.md': { c: 'EXAM', i: '🎓', t: ['考研'], d: '408 四门课（数据结构/组成原理/操作系统/计算机网络）的复习策略与资料选择。' },
  '资料/冷启动资料/10-保研全流程.md': { c: 'EXAM', i: '🥇', t: ['保研'], d: '保研从大一绩点、夏令营、预推免到系统填报的全流程时间线与避坑。' },
  '资料/冷启动资料/11-校招时间线与避坑.md': { c: 'CAREER', i: '📅', t: ['校招攻略'], d: '秋招春招时间线：实习转正、提前批、正式批怎么排，offer 怎么比。' },
  '资料/冷启动资料/12-四六级自救指南.md': { c: 'EXAM', i: '🆘', t: ['四级', '六级'], d: '四六级低分自救指南：分值结构与各分数段性价比最高的提分动作。' },
  '资料/留学2/00-资料总览与筛选说明.docx': { c: 'ABROAD', i: '🗂', t: ['选校定位'], d: '整套留学资料库的总览与使用指南：按国家与申请阶段告诉你先看哪份。', fine: true },
  // campus-market-materials md
  'campus-market-materials/资料0-计算机第零课.md': { c: 'CAMPUS', i: '🖥', t: ['选课攻略'], d: '写给刚进大学的计算机新生：这个专业到底学什么，怎么学才算入门。' },
  'campus-market-materials/资料1-计算机第一课.md': { c: 'CAMPUS', i: '⌨️', t: ['选课攻略'], d: '大学第一学期怎么过：选课、自学路线与常见误区，学长踩过的坑都在这。' },
  'campus-market-materials/资料2-计算机方向全景图.md': { c: 'LIFE', i: '🔭', t: ['方向选择'], d: '计算机各就业方向全景：后端、前端、AI、安全、测试的技能要求与前景对比。', fine: true },
};

// 留学2 目录规则：国家 → (tag, icon, course)
const ABROAD_MAP = {
  零基础入门: { tag: '选校定位', icon: '🧭', course: '留学-入门', desc: '留学零基础入门', fine: true },
  美国: { tag: '美国', icon: '🇺🇸', course: '留学-美国', desc: '美国留学申请资料' },
  英国: { tag: '英国', icon: '🇬🇧', course: '留学-英国', desc: '英国留学申请资料' },
  香港: { tag: '香港', icon: '🇭🇰', course: '留学-香港', desc: '香港留学申请资料' },
  新加坡: { tag: '新加坡', icon: '🇸🇬', course: '留学-新加坡', desc: '新加坡留学申请资料' },
  澳洲新西兰: { tag: '澳洲', icon: '🇦🇺', course: '留学-澳新', desc: '澳洲与新西兰留学资料' },
  加拿大: { tag: '加拿大', icon: '🇨🇦', course: '留学-加拿大', desc: '加拿大留学申请资料' },
  澳门: { tag: '澳门', icon: '🇲🇴', course: '留学-澳门', desc: '澳门留学申请资料' },
  非美与小众国家: { tag: '文书', icon: '🌏', course: '留学-其他地区', desc: '非美与小众地区留学资料' },
};
// 留学目录中精选进精品位的代表作（第一部/总览类）
const ABROAD_FINE = /(入门总指南|美国研究生申请资料-part1|英研各院校入学要求与录取List-part1|澳洲院校资料汇编-part1|香港硕士申请|加拿大本科申请|语言考试与标准化考试指南)/;

// 路线图（campus-market-materials/roadmaps/）
const ROADMAPS = [
  { file: '01-Java从零到现代化网页开发.md', title: 'Java 从零到现代化网页开发', cat: 'BACKEND', icon: '☕', sum: '零基础到能写出上线网站：环境、语法、Spring Boot、前后端打通与部署，按周推进。' },
  { file: '02-CPP入门与技术栈全景.md', title: 'C++ 入门与技术栈全景', cat: 'BACKEND', icon: '🔧', sum: '从语法到工程级 C++：内存模型、STL、现代特性与主流应用方向的全景路线。' },
  { file: '03-产品经理入门.md', title: '产品经理入门', cat: 'OTHER', icon: '📐', sum: '产品思维、需求分析、原型与数据，从 0 建立产品经理的能力框架。' },
  { file: '04-AIAgent开发路线.md', title: 'AI Agent 开发路线', cat: 'AI', icon: '🤖', sum: '从 Prompt 工程到多智能体系统：LLM 应用、RAG、工具调用与 Agent 框架实战。' },
  { file: '05-AI产品经理入门.md', title: 'AI 产品经理入门', cat: 'OTHER', icon: '✨', sum: '大模型时代的产品经理：模型能力边界、AI 功能设计、评测与增长。' },
];

// ---------- 构建 manifest ----------
function extOf(p) { return p.split('.').pop().toUpperCase(); }
function titleOf(name) { return name.replace(/\.(docx?|md)$/i, ''); }

function buildManifest() {
  const items = [];
  // 特例文件
  for (const [path, meta] of Object.entries(SPECIAL)) {
    items.push({ path: join(ROOT, path), ...meta });
  }
  // 留学2 按目录规则（walk）
  const abroadRoot = join(ROOT, '资料/留学2');
  for (const dir of readdirSync(abroadRoot, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const rule = ABROAD_MAP[dir.name];
    if (!rule) { console.warn(`⚠ 未知留学目录：${dir.name}（跳过）`); continue; }
    for (const f of readdirSync(join(abroadRoot, dir.name))) {
      if (!/\.(docx?)$/i.test(f)) continue;
      const title = titleOf(f);
      items.push({
        path: join(abroadRoot, dir.name, f),
        c: 'ABROAD',
        i: rule.icon,
        t: [...new Set([rule.tag, /文书|案例/.test(title) ? '文书' : /签证|行前/.test(title) ? '签证行前' : '选校定位'])].slice(0, 2),
        d: `${rule.desc}：${title}。${/part/i.test(f) ? '系列资料之一。' : ''}`,
        course: rule.course,
        fine: ABROAD_FINE.test(f),
      });
    }
  }
  return items;
}

// ---------- 上传 ----------
async function uploadWork(item) {
  const size = statSync(item.path).size;
  const fileType = extOf(item.path) === 'DOC' ? 'DOC' : extOf(item.path);
  await redis.del(`rl:upload:u_admin`); // 批量导入绕过 10/h 限流
  const pre = await api('POST', '/api/v1/uploads/presign', {
    kind: 'work', fileType, fileSize: size,
  });
  const buf = readFileSync(item.path);
  const put = await fetch(pre.putUrl, { method: 'PUT', body: buf, headers: { 'content-type': 'application/octet-stream' } });
  if (!put.ok) throw new Error(`PUT ${item.path} → ${put.status}`);
  const name = item.path.split('/').pop();
  await api('POST', '/api/v1/works', {
    title: titleOf(name).slice(0, 120),
    description: item.d,
    course: item.course ?? '通用资料',
    fileType,
    fileKey: pre.fileKey,
    fileSize: size,
    coverIcon: item.i ?? '📄',
    coverTheme: THEMES[themeI++ % THEMES.length],
    category: item.c,
    isFree: !item.fine,
    price: item.fine ? '9.90' : undefined,
    tags: item.t ?? [],
    previewToc: [],
    isOriginal: true,
    copyrightAccepted: true,
  });
}

async function uploadRoadmap(r) {
  const path = join(ROOT, 'campus-market-materials/roadmaps', r.file);
  const size = statSync(path).size;
  await redis.del('rl:upload:u_admin');
  // roadmap kind 统一走 OTHER（服务端强制 .md 扩展与 text/markdown）
  const pre = await api('POST', '/api/v1/uploads/presign', { kind: 'roadmap', fileType: 'OTHER', fileSize: size });
  const put = await fetch(pre.putUrl, { method: 'PUT', body: readFileSync(path) });
  if (!put.ok) throw new Error(`PUT ${path} → ${put.status}`);
  await api('POST', '/api/v1/roadmaps', {
    title: r.title, summary: r.sum, category: r.cat,
    coverIcon: r.icon, mdSourceKey: pre.fileKey, workIds: [],
  });
}

async function main() {
  await api('POST', '/api/v1/auth/login', ADMIN);
  console.log('✔ admin 登录');
  // 幂等：拉已传作品标题集（重跑跳过同名）
  const doneSet = new Set();
  try {
    const mine = await api('GET', '/api/v1/me/creator/works?page=1&pageSize=200');
    for (const w of mine.data ?? []) doneSet.add(w.title);
    if (doneSet.size) console.log(`已有 ${doneSet.size} 个作品，重跑将跳过同名`);
  } catch { /* admin 无 creator 档案时忽略 */ }
  const items = buildManifest().filter((it) => {
    const name = it.path.split('/').pop();
    return !doneSet.has(titleOf(name).slice(0, 120));
  });
  console.log(`待上传作品 ${items.length} 个 + 路线图 ${ROADMAPS.length} 个`);
  let ok = 0, fail = 0;
  for (const [i, it] of items.entries()) {
    try {
      await uploadWork(it);
      ok++;
      if (ok % 10 === 0 || i === items.length - 1) console.log(`  作品 ${ok}/${items.length}`);
    } catch (e) { fail++; console.error(`  ✘ ${it.path}: ${e.message}`); }
  }
  let rok = 0;
  for (const r of ROADMAPS) {
    try { await uploadRoadmap(r); rok++; } catch (e) { console.error(`  ✘ 路线图 ${r.file}: ${e.message}`); }
  }
  console.log(`\n完成：作品 ${ok} 成功 ${fail} 失败；路线图 ${rok}/${ROADMAPS.length}`);
  console.log('别忘了发布 DRAFT：docker exec cm-postgres psql -U cm -d campus_market -c "UPDATE works SET status=\'PUBLISHED\', \"publishedAt\"=now() WHERE \"authorId\"=\'u_admin\' AND status=\'DRAFT\'"');
  await redis.quit();
}
main().catch((e) => { console.error(e); process.exit(1); });
