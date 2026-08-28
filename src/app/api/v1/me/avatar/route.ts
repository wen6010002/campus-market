import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { meService } from '@/server/services/me.service';
import { z } from 'zod';

const avatarSchema = z.object({ avatarKey: z.string().max(200).nullable() });

/** 设置/清除头像（V3-5）：前端先 presign kind=avatar 直传，再传 avatarKey */
export const POST = withErrorHandler(async (req: Request) => {
  const s = await requireUser();
  const { avatarKey } = avatarSchema.parse(await readJson(req));
  return ok(await meService.setAvatar(s.userId, avatarKey));
});
