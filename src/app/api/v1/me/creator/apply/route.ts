import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { authService } from '@/server/services/auth.service';
import { creatorApplySchema } from '@/lib/zod/auth';

export const POST = withErrorHandler(async (req: Request) => {
  const s = await requireUser();
  const input = creatorApplySchema.parse(await readJson(req));
  const creator = await authService.applyCreator(s.userId, input);
  return ok(
    {
      id: creator.id,
      bio: creator.bio,
      direction: creator.direction,
      honor: creator.honor,
      verified: creator.verified,
    },
    { status: 201 },
  );
});
