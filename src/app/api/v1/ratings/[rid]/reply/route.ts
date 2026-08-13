import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { ratingService } from '@/server/services/rating.service';
import { requireUser } from '@/server/auth/session';
import { ratingReplySchema } from '@/lib/zod/rating';

type Ctx = { params: { rid: string } };

export const POST = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const s = await requireUser();
  const { text } = ratingReplySchema.parse(await readJson(req));
  const rating = await ratingService.reply(ctx.params.rid, s.userId, text);
  return ok(rating);
});
