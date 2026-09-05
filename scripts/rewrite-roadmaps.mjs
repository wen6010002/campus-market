#!/usr/bin/env node
// 路线图 md 批量重写（纯 JS 版，无 tsx 依赖）：
// 阶段标题去周数（（第 1-2 周）等）+ 删 mermaid 流程图块，
// 覆盖 MinIO 源文件并重新解析更新 roadmaps.content/stepsCount。
// parse 逻辑内联自 src/lib/roadmap/parse.ts（保持一致；改解析器时同步这里）。
// 用法（migrate 容器内，需 Prisma client 与 MinIO env）：
//   node scripts/rewrite-roadmaps.mjs [--apply]
import { PrismaClient } from '@prisma/client';
import * as AWS from '@aws-sdk/client-s3';

const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient();

const s3 = new AWS.S3({
  endpoint: process.env.S3_ENDPOINT || 'http://minio:9000',
  region: process.env.S3_REGION || 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || process.env.MINIO_ROOT_USER || '',
    secretAccessKey: process.env.S3_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || '',
  },
});
const BUCKET = process.env.S3_BUCKET || 'campus-market';
const getObjectText = async (key) => (await s3.getObject({ Bucket: BUCKET, Key: key })).Body.transformToString();
const putObject = (key, text) =>
  s3.putObject({ Bucket: BUCKET, Key: key, Body: text, ContentType: 'text/markdown; charset=utf-8' });

// ---------- parse（内联自 src/lib/roadmap/parse.ts） ----------
function parseRoadmapMd(src) {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const phases = [];
  let phase = null;
  let lastStep = null;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { lastStep = null; continue; }
    const heading = raw.match(/^##\s+(.*)$/);
    if (heading) {
      const title = heading[1].trim().slice(0, 120);
      if (!title) continue;
      phase = { title, desc: '', steps: [] };
      phases.push(phase);
      lastStep = null;
      continue;
    }
    const step = raw.match(/^\s*-\s+\[[ xX]?\]\s*(.*)$/);
    if (step && phase) {
      const text = step[1].trim().slice(0, 200);
      if (!text) continue;
      const id = `p${phases.length - 1}-s${phase.steps.length}`;
      lastStep = { id, text };
      phase.steps.push(lastStep);
      continue;
    }
    if (lastStep && /^\s{2,}\S/.test(raw) && !/^\s*-\s/.test(raw)) {
      const note = raw.trim().slice(0, 200);
      lastStep.note = lastStep.note ? `${lastStep.note}${note}` : note;
      continue;
    }
    if (phase) phase.desc = phase.desc ? `${phase.desc}${line.trim()}` : line.trim();
  }
  return { ok: true, content: { phases }, stepsCount: phases.reduce((n, p) => n + p.steps.length, 0) };
}

// ---------- 重写规则 ----------
// 仅 ## 阶段标题行的周数后缀：（第 1-2 周）（第3周）（第 1~2 周）（第 1、2 周 · 机动）等
const WEEK = /（\s*第\s*[\d\s\-—~、至和周·,，\s]*周[^）]*）\s*/g;
const MERMAID = /```mermaid[\s\S]*?```/g;

function rewrite(md) {
  const out = [];
  for (const line of md.split('\n')) {
    out.push(/^##\s+/.test(line) ? line.replace(WEEK, '') : line);
  }
  let s = out.join('\n');
  const mermaidCount = (s.match(MERMAID) ?? []).length;
  s = s.replace(MERMAID, '').replace(/\n{3,}/g, '\n\n');
  return { s, mermaidCount };
}

async function main() {
  const roadmaps = await prisma.roadmap.findMany({
    select: { id: true, title: true, mdSourceKey: true, stepsCount: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`共 ${roadmaps.length} 个路线图 | ${APPLY ? '应用模式' : 'DRY-RUN（加 --apply 生效）'}\n`);
  for (const r of roadmaps) {
    const before = await getObjectText(r.mdSourceKey);
    const { s: after, mermaidCount } = rewrite(before);
    if (after === before) { console.log(`= ${r.title}：无需改动`); continue; }
    const weeksBefore = (before.match(/^##[^\n]*（[^）]*周[^）]*）/gm) ?? []).map((x) => x.trim());
    const parsed = parseRoadmapMd(after);
    if (!parsed.ok || parsed.stepsCount !== r.stepsCount) {
      console.log(`⚠ ${r.title}：步骤数 ${r.stepsCount}→${parsed.stepsCount}（解析结构变化，注意打卡兼容）`);
    }
    console.log(`✎ ${r.title}：去周数 ${weeksBefore.length} 处 | 删 mermaid ${mermaidCount} 块 | 步骤 ${r.stepsCount}→${parsed.stepsCount}`);
    for (const w of weeksBefore.slice(0, 3)) console.log(`    ${w}`);
    if (weeksBefore.length > 3) console.log(`    …共 ${weeksBefore.length} 处`);
    if (APPLY) {
      await putObject(r.mdSourceKey, after);
      await prisma.roadmap.update({
        where: { id: r.id },
        data: { content: parsed.content, stepsCount: parsed.stepsCount, updatedAt: new Date() },
      });
    }
  }
  console.log(APPLY ? '\n已写入 MinIO 并更新 DB' : '\n（dry-run 未写入）');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
