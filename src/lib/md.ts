import { marked } from 'marked';
import DOMPurify from 'dompurify';

/** md → 安全 HTML（同步解析；GFM 表格/删除线默认开）。
 *  用户上传的 md 可嵌脚本，必须 DOMPurify 消毒；预览弹窗与详情页内嵌预览共用。 */
export function renderMd(text: string): string {
  return DOMPurify.sanitize(marked.parse(text, { async: false }), {
    FORBID_TAGS: ['style', 'form', 'input', 'iframe'],
  });
}

/** 把 markdown 全文在标题行边界处切成「前 ~30% / 剩余」两段（内嵌预览默认只展示前段）。
 *  找离 30% 最近的一二三级标题行；找不到合适边界（短文/无标题）返回 null，调用方直接展示全文。 */
export function splitMdHead(content: string): { part: string; rest: string } | null {
  if (content.length < 1600) return null;
  const target = content.length * 0.3;
  let best = -1;
  let pos = 0;
  for (const line of content.split('\n')) {
    if (/^#{1,3} /.test(line)) {
      if (best === -1 || Math.abs(pos - target) < Math.abs(best - target)) best = pos;
    }
    pos += line.length + 1;
  }
  // 边界太靠前（<12%）或太靠后（>62%）都不当作“前 30%”，直接全文
  if (best <= 0 || best < content.length * 0.12 || best > content.length * 0.62) return null;
  return { part: content.slice(0, best), rest: content.slice(best) };
}
