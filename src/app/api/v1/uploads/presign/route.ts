import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { uploadService } from '@/server/services/upload.service';
import { requireCreator } from '@/server/auth/session';
import { z } from 'zod';
import { FileType } from '@/lib/constants';

const presignSchema = z.object({
  fileType: z.nativeEnum(FileType),
  fileSize: z.number().int().min(0).max(209715200),
  sha: z.string().optional(),
});

export const POST = withErrorHandler(async (req: Request) => {
  const s = await requireCreator();
  const input = presignSchema.parse(await readJson(req));
  const result = await uploadService.presign(input, s.userId);
  return ok(result);
});
