// V12 敏感词匹配器：归一化管线（全角/零宽/大小写/干扰符）+ REJECT/REVIEW 分级 + URL 检测
import { describe, it, expect } from 'vitest';
import { checkBlocked, containsUrl, normalizeText, packText } from '@/server/moderation/words';
import { dayCn8 } from '@/lib/day';

describe('V12 敏感词匹配', () => {
  it('哨兵词与校园专项 REJECT 命中', () => {
    expect(checkBlocked('这段有课搭测试违禁词'))?.toMatchObject({ action: 'REJECT' });
    expect(checkBlocked('有人代考吗'))?.toMatchObject({ action: 'REJECT', category: 'CAMPUS' });
    expect(checkBlocked('出期末答案 联系我'))?.toMatchObject({ action: 'REJECT' });
  });

  it('变体对抗：全角/大小写/零宽/加空格/加干扰符', () => {
    // 全角（NFKC 归一后命中）+ 大写
    expect(checkBlocked('ＦＵＣＫ this')).toMatchObject({ action: 'REJECT', category: 'PORN' });
    // 中文词加空格（打包后命中）
    expect(checkBlocked('有 人 代 考 吗'))?.toMatchObject({ action: 'REJECT' });
    // 加干扰符（·、，、-）
    expect(checkBlocked('代·考包过'))?.toMatchObject({ action: 'REJECT' });
    // 零宽字符（​）
    expect(checkBlocked(`代​考`))?.toMatchObject({ action: 'REJECT' });
  });

  it('广告类是 REVIEW（转待审不硬拒）', () => {
    const hit = checkBlocked('有没有兼职刷单群');
    expect(hit).toMatchObject({ action: 'REVIEW' });
  });

  it('正常学习讨论零误伤', () => {
    for (const text of [
      '这份资料对期末复习有帮助吗',
      '想问一下计组这门课怎么学',
      '学长，配套的代码仓库在 GitHub 能搜到吗',
      '淘宝上买的教材到了，一起自习吗',
      '群里说今天下午两点讨论作业',
      'js 基础看哪份笔记比较好',
    ]) {
      expect(checkBlocked(text)).toBeNull();
    }
  });

  it('REJECT 优先于 REVIEW（同文本两种命中时从严）', () => {
    const hit = checkBlocked('兼职刷单群还能代考吗');
    expect(hit?.action).toBe('REJECT');
  });

  it('URL 检测', () => {
    expect(containsUrl('看这个 https://example.com/x')).toBe(true);
    expect(containsUrl('WWW.EXAMPLE.COM 大写')).toBe(true);
    expect(containsUrl('没有链接的普通内容')).toBe(false);
    expect(containsUrl('')).toBe(false);
  });

  it('normalize/pack 纯函数行为', () => {
    expect(normalizeText('Ａｂｃ')).toBe('abc');
    expect(packText('微 信')).toBe('微信');
    expect(packText('a-b_c')).toBe('abc');
  });
});

describe('dayCn8（UTC+8 日界）', () => {
  it('UTC 时间 +8 小时取日', () => {
    expect(dayCn8(new Date('2026-09-10T16:00:00Z'))).toBe('2026-09-11'); // UTC 16点 = 北京 0点（次日）
    expect(dayCn8(new Date('2026-09-10T15:59:00Z'))).toBe('2026-09-10');
    expect(dayCn8(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01');
  });
});
