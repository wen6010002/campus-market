import { randomUUID } from 'node:crypto';
import { appError } from '../lib/errors';
import { enforceRateLimit } from '../lib/ratelimit';
import { presignPut } from '../storage/minio';
import { FileType, MAX_FILE_SIZE } from '@/lib/constants';

/** FileType → 存储扩展名（下载文件名也用它拼 title.ext） */
export const EXT: Record<FileType, string> = {
  PDF: 'pdf',
  MD: 'md',
  DOC: 'doc',
  DOCX: 'docx',
  PPT: 'ppt',
  PPTX: 'pptx',
  ZIP: 'zip',
  IMAGE: 'img',
  OTHER: 'bin',
};

/** md 作品上限（纯文本资料足够，超限说明该换 PDF 承载）；试读副本同享 */
const MAX_MD_SIZE = 10 * 1024 * 1024;

/** 上传用途（V3 + V4 路线图）：不同前缀 / 类型白名单 / 大小上限 */
export type PresignKind = 'work' | 'cover' | 'avatar' | 'preview' | 'roadmap' | 'credential';

const KIND_RULES: Record<
  PresignKind,
  {
    prefix: string;
    types: FileType[];
    maxSize: number;
    contentType: (t: FileType) => string;
    ext?: string;
  }
> = {
  work: {
    prefix: 'works',
    types: Object.values(FileType) as FileType[],
    maxSize: MAX_FILE_SIZE,
    // md 存 text/markdown，浏览器/预览端能按文本识别；其余保持二进制流
    contentType: (t) => (t === 'MD' ? 'text/markdown; charset=utf-8' : 'application/octet-stream'),
  },
  cover: {
    prefix: 'covers',
    types: ['IMAGE'],
    maxSize: 5 * 1024 * 1024,
    contentType: () => 'image/jpeg',
  },
  avatar: {
    prefix: 'avatars',
    types: ['IMAGE'],
    maxSize: 5 * 1024 * 1024,
    contentType: () => 'image/jpeg',
  },
  preview: {
    prefix: 'previews',
    types: ['PDF', 'MD'],
    maxSize: 30 * 1024 * 1024,
    // PDF 试读副本 = pdf-lib 截前 5 页；MD 试读副本 = 上传端截断文本（30%/3000 字）
    contentType: (t) => (t === 'MD' ? 'text/markdown; charset=utf-8' : 'application/pdf'),
  },
  // V4：路线图 md 原文（FileType 无 MD，走 OTHER + text/markdown + .md 扩展名特判）
  roadmap: {
    prefix: 'roadmaps',
    types: ['OTHER'],
    maxSize: 2 * 1024 * 1024,
    contentType: () => 'text/markdown; charset=utf-8',
    ext: 'md',
  },
  // V4：路线图上传者学生证（供审核）
  credential: {
    prefix: 'credentials',
    types: ['IMAGE'],
    maxSize: 5 * 1024 * 1024,
    contentType: () => 'image/jpeg',
  },
};

export const uploadService = {
  /** 直传预签名：按 kind 校验类型白名单 + 大小上限 + 每用户限流 → 返回 { fileKey, putUrl } */
  async presign(
    input: { kind?: PresignKind; fileType: FileType; fileSize: number; sha?: string },
    userId: string,
  ) {
    const kind: PresignKind = input.kind ?? 'work';
    const rule = KIND_RULES[kind];
    if (!rule.types.includes(input.fileType)) {
      throw appError(
        'FILE_TYPE_DENIED',
        kind === 'roadmap' ? '路线图仅支持 .md 文件' : '不支持该文件类型',
      );
    }
    if (input.fileSize <= 0 || input.fileSize > rule.maxSize) {
      throw appError('FILE_TOO_LARGE', kind === 'work' ? '文件超出 200MB 上限' : '文件超出上限');
    }
    // md 特判：作品与试读副本共用 10MB 上限（其余类型不受影响）
    if (input.fileType === 'MD' && input.fileSize > MAX_MD_SIZE) {
      throw appError('FILE_TOO_LARGE', 'Markdown 文件超出 10MB 上限');
    }
    await enforceRateLimit(`rl:upload:${userId}`, 10, 3600_000);
    const ext = rule.ext ?? EXT[input.fileType];
    const fileKey = `${rule.prefix}/${userId}/${randomUUID()}.${ext}`;
    const putUrl = await presignPut(fileKey, rule.contentType(input.fileType));
    return { fileKey, putUrl };
  },
};
