/**
 * 编译敏感词字典 → src/server/moderation/words.data.ts
 *
 * 为什么编译成 TS 常量而不是运行时 fs 读 txt：
 * Next standalone 构建只会打包被 import trace 到的文件，fs 读 txt 在生产镜像里会炸。
 *
 * 用法：pnpm build:words（改 dict/*.txt 后必须重跑，words.data.ts 一并提交）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DICT = join(ROOT, 'src/server/moderation/dict');

type Action = 'REJECT' | 'REVIEW';

/** 文件 → 分类；分类决定处置动作（words.ts 里映射） */
const FILES: Array<{ file: string; category: string; action: Action }> = [
  { file: 'porn.txt', category: 'PORN', action: 'REJECT' },
  { file: 'politics.txt', category: 'POLITICS', action: 'REJECT' },
  { file: 'illegal.txt', category: 'ILLEGAL', action: 'REJECT' },
  { file: 'ads.txt', category: 'ADS', action: 'REVIEW' },
  { file: 'campus-reject.txt', category: 'CAMPUS', action: 'REJECT' },
  { file: 'campus-review.txt', category: 'CAMPUS', action: 'REVIEW' },
];

/** 剔除校园语境里过于常见、会造成大量误伤的 ADS 词（转待审也烦死人） */
const EXCLUDE = new Set([
  '兼职',
  '招聘',
  '网络',
  'qq',
  '扣扣',
  '客服',
  '淘宝',
  '全职',
  '网购',
  '代理',
  '免费使用',
  '免费索取',
  '下载速度',
  'txt下载',
  '高清在线',
  '全集在线',
  '在线播放',
  'js',
  'bt',
  'ly',
  '3p',
  'sm',
  '有意者',
  '到货',
  '本店',
  '微店',
  '小姐',
  '帮忙点一下',
  '帮忙点下',
  '请点击进入',
  '详情请进入',
  '救市',
  '证监会',
]);

/** 哨兵词：冒烟脚本用它验证拦截链路（REJECT 级） */
const SENTINEL = '课搭测试违禁词';

/** ads.txt 里混着的赌博/严重违法词，从 REVIEW 提升为 REJECT（从严） */
const PROMOTE_TO_REJECT = new Set([
  '足球投注',
  '地下钱庄',
  '六合彩',
  '曾道人',
  '赌博',
  '赌球',
  '博彩',
  '借腹生子',
  '代孕妈妈',
  '代生孩子',
  '用刀横向切腹',
  '完全自杀手册',
  '婴儿汤',
  '四海帮',
  '中国复兴党',
  '信用卡提现',
  '刻章办',
]);

function parse(file: string): string[] {
  const raw = readFileSync(join(DICT, file), 'utf8');
  return raw
    .split(/\r?\n/)
    .flatMap((line) =>
      file === 'porn.txt' || file === 'politics.txt' ? line.split(/[,，]/) : [line],
    )
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 2 && w.length <= 40)
    .filter((w) => !EXCLUDE.has(w));
}

const seen = new Map<string, { category: string; action: Action }>();
for (const { file, category, action } of FILES) {
  for (const word of parse(file)) {
    const act: Action = PROMOTE_TO_REJECT.has(word) ? 'REJECT' : action;
    // 同词多源：REJECT 优先于 REVIEW（从严）
    const prev = seen.get(word);
    if (!prev || (prev.action === 'REVIEW' && act === 'REJECT')) {
      seen.set(word, { category, action: act });
    }
  }
}
seen.set(SENTINEL, { category: 'CAMPUS', action: 'REJECT' });

const groups: Record<string, string[]> = {};
for (const [word, meta] of seen) {
  const key = `${meta.category}:${meta.action}`;
  (groups[key] ??= []).push(word);
}

const today = new Date().toISOString().slice(0, 10);
let out = `// 由 scripts/build-words.ts 生成（${today}）——不要手改，改 dict/*.txt 后跑 pnpm build:words
// 来源：fwwdn/sensitive-stop-words（Apache-2.0，见 dict/LICENSE.sensitive-stop-words）+ 自建校园词表
// 词条数：${seen.size}
export type WordCategory = 'PORN' | 'POLITICS' | 'ILLEGAL' | 'ADS' | 'CAMPUS';
export type WordAction = 'REJECT' | 'REVIEW';

/** 词表分组：分类:动作 → 词数组 */
export const WORD_GROUPS: Record<string, string[]> = {
`;
for (const key of Object.keys(groups).sort()) {
  out += `  ${JSON.stringify(key)}: [\n`;
  for (let i = 0; i < groups[key].length; i += 8) {
    out +=
      '    ' +
      groups[key]
        .slice(i, i + 8)
        .map((w) => JSON.stringify(w))
        .join(', ') +
      ',\n';
  }
  out += '  ],\n';
}
out += '};\n';

const target = join(ROOT, 'src/server/moderation/words.data.ts');
writeFileSync(target, out);
console.log(`OK: ${seen.size} words -> ${target}`);
for (const key of Object.keys(groups).sort()) {
  console.log(`  ${key}: ${groups[key].length}`);
}
