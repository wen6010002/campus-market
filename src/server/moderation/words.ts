/**
 * 敏感词匹配器（V12）——同步毫秒级，评论创建与评价文字共用。
 *
 * 变体对抗（归一化管线）：
 * 1. NFKC：全角→半角（"ｆｕｃｋ"→"fuck"、全角数字/字母）
 * 2. 去零宽字符：zero-width joiner/non-joiner/BOM（"微​信"）
 * 3. lowercase：大小写混淆（"FuCk"）
 * 4. 打包扫描：去掉全部空白与常见干扰符后再匹配（"微 信"“微·信”“代,考”）
 *
 * 词表由 scripts/build-words.ts 从 dict/*.txt 编译（words.data.ts），运行时不读文件。
 * 匹配结果分两级：REJECT=硬拒（色情/涉政/涉枪爆/赌博/校园代考代写），
 * REVIEW=转人工待审（广告刷单类——同学问「有没有兼职」不该被硬拒）。
 */
import { WORD_GROUPS } from './words.data';
import type { WordAction, WordCategory } from './words.data';

export type { WordAction, WordCategory };

export interface WordHit {
  word: string;
  category: WordCategory;
  action: WordAction;
}

/** 归一化：NFKC 全角→半角、去零宽、lowercase */
export function normalizeText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
    .toLowerCase();
}

/** 打包：归一化后去掉空白与常见干扰填充符（用于对抗"微 信""代·考"式变体） */
export function packText(normalized: string): string {
  return normalized.replace(/[\s·•・。．.,，、;；:：!！?？~～*^_-]+/g, '');
}

interface TrieNode {
  children: Map<string, TrieNode>;
  hit: WordHit | null;
}

function buildTrie(): TrieNode {
  const root: TrieNode = { children: new Map(), hit: null };
  for (const [group, words] of Object.entries(WORD_GROUPS)) {
    const [category, action] = group.split(':') as [WordCategory, WordAction];
    for (const raw of words) {
      const word = packText(normalizeText(raw));
      if (!word) continue;
      let node = root;
      for (const ch of word) {
        let next = node.children.get(ch);
        if (!next) {
          next = { children: new Map(), hit: null };
          node.children.set(ch, next);
        }
        node = next;
      }
      // 同词重复入表（构建期已去重，此处兜底）：REJECT 覆盖 REVIEW
      if (!node.hit || (node.hit.action === 'REVIEW' && action === 'REJECT')) {
        node.hit = { word: raw, category, action };
      }
    }
  }
  return root;
}

const TRIE = buildTrie();

/** 扫描打包文本，收集全部命中（词表 1.2k 规模 + 评论 ≤600 字，单趟扫描微秒级） */
function scan(packed: string): WordHit[] {
  const hits: WordHit[] = [];
  const chars = Array.from(packed);
  for (let i = 0; i < chars.length; i++) {
    let node: TrieNode | null | undefined = TRIE.children.get(chars[i]);
    if (!node) continue;
    let j = i;
    while (node) {
      if (node.hit) hits.push(node.hit);
      j++;
      node = j < chars.length ? node.children.get(chars[j]) : undefined;
    }
  }
  return hits;
}

/** 检查文本是否命中违禁词：REJECT 命中优先返回（从严），无 REJECT 才返回 REVIEW */
export function checkBlocked(text: string): WordHit | null {
  if (!text) return null;
  const hits = scan(packText(normalizeText(text)));
  if (!hits.length) return null;
  return hits.find((h) => h.action === 'REJECT') ?? hits[0];
}

/** URL 检测：含链接的评论不公开（PENDING_REVIEW），钓鱼/导流是最高举报风险 */
export const URL_RE = /(https?:\/\/|www\.)\S+/i;

export function containsUrl(text: string): boolean {
  return URL_RE.test(normalizeText(text));
}
