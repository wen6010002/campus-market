import { describe, it, expect } from 'vitest';
import { uploadService } from '@/server/services/upload.service';
import { FileType } from '@/lib/constants';

describe('上传预签名校验', () => {
  it('非法文件类型 → FILE_TYPE_DENIED', async () => {
    await expect(
      uploadService.presign({ fileType: 'TXT' as unknown as FileType, fileSize: 100 }, 'u1'),
    ).rejects.toMatchObject({ code: 'FILE_TYPE_DENIED' });
  });

  it('超过 200MB → FILE_TOO_LARGE', async () => {
    await expect(
      uploadService.presign({ fileType: FileType.PDF, fileSize: 209715201 }, 'u1'),
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });

  it('零/负大小 → FILE_TOO_LARGE', async () => {
    await expect(
      uploadService.presign({ fileType: FileType.PDF, fileSize: 0 }, 'u1'),
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });
});
