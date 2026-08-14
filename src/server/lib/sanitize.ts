import sanitizeHtml from 'sanitize-html';

// XSS 防护：用户输入富文本白名单清洗（允许加粗/斜体/换行，剥离脚本与属性）。
const ALLOWED = {
  allowedTags: ['b', 'strong', 'i', 'em', 'br'],
  allowedAttributes: {},
};

export function sanitize(input: string): string {
  if (!input) return input;
  return sanitizeHtml(input, ALLOWED).trim();
}
