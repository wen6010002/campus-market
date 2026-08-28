import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { meService } from '@/server/services/me.service';
import { z } from 'zod';

const profileSchema = z.object({
  username: z.string().trim().min(2).max(30).optional(),
  bio: z.string().trim().max(200).nullable().optional(),
  college: z.string().trim().max(60).optional(),
  grade: z.string().trim().max(30).optional(),
  major: z.string().trim().max(60).optional(),
});

/** 编辑资料（V3-5） */
export const PATCH = withErrorHandler(async (req: Request) => {
  const s = await requireUser();
  const input = profileSchema.parse(await readJson(req));
  return ok(await meService.updateProfile(s.userId, input));
});
