import { randomUUID } from 'node:crypto';
import { prisma } from '../db';
import { appError } from '../lib/errors';
import { presignPut } from '../storage/minio';
import { FileType, MAX_FILE_SIZE, WorkStatus } from '@/lib/constants';

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

export const uploadService = {
  /** 直传预签名：校验类型白名单 + 大小上限 → 返回 { fileKey, putUrl } */
  async presign(input: { fileType: FileType; fileSize: number; sha?: string }, userId: string) {
    if (!Object.values(FileType).includes(input.fileType)) {
      throw appError('FILE_TYPE_DENIED', '不支持该文件类型');
    }
    if (input.fileSize <= 0 || input.fileSize > MAX_FILE_SIZE) {
      throw appError('FILE_TOO_LARGE', '文件超出 200MB 上限');
    }
    const fileKey = `works/${userId}/${randomUUID()}.${EXT[input.fileType]}`;
    const putUrl = await presignPut(fileKey);
    return { fileKey, putUrl };
  },
};
