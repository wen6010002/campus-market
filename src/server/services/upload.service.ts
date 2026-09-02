import { randomUUID } from 'node:crypto';
import { appError } from '../lib/errors';
import { enforceRateLimit } from '../lib/ratelimit';
import { presignPut } from '../storage/minio';
import { FileType, MAX_FILE_SIZE } from '@/lib/constants';

const EXT: Record<FileType, string> = {
  PDF: 'pdf',
  DOC: 'doc',
  DOCX: 'docx',
  PPT: 'ppt',
  PPTX: 'pptx',
  ZIP: 'zip',
  IMAGE: 'img',
  OTHER: 'bin',
};

/** 上传用途（V3 + V4 路线图）：不同前缀 / 类型白名单 / 大小上限 */
export type PresignKind = 'work' | 'cover' | 'avatar' | 'preview' | 'roadmap' | 'credential';

const KIND_RULES: Record<
  PresignKind,
  { prefix: string; types: FileType[]; maxSize: number; contentType: (t: FileType) => string; ext?: string }
> = {
  work: {
    prefix: 'works',
    types: Object.values(FileType) as FileType[],
    maxSize: MAX_FILE_SIZE,
    contentType: () => 'application/octet-stream',
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
    types: ['PDF'],
    maxSize: 30 * 1024 * 1024,
    contentType: () => 'application/pdf',
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
      throw appError(
        'FILE_TOO_LARGE',
        kind === 'work' ? '文件超出 200MB 上限' : '文件超出上限',
      );
    }
    await enforceRateLimit(`rl:upload:${userId}`, 10, 3600_000);
    const ext = rule.ext ?? EXT[input.fileType];
    const fileKey = `${rule.prefix}/${userId}/${randomUUID()}.${ext}`;
    const putUrl = await presignPut(fileKey, rule.contentType(input.fileType));
    return { fileKey, putUrl };
  },
};
