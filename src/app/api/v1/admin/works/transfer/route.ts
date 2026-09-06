import { z } from 'zod';
import { requireAdmin } from '@/server/auth/session';
import { readJson, ok, withErrorHandler } from '@/server/lib/http';
import { adminService } from '@/server/services/admin.service';

const transferSchema = z.object({
  workIds: z.array(z.string().min(1)).min(1).max(100),
  targetEmail: z.string().trim().email(),
  reason: z.string().trim().min(2).max(300),
});

export const POST = withErrorHandler(async (req: Request) => {
  const admin = await requireAdmin();
  const input = transferSchema.parse(await readJson(req));
  return ok(await adminService.transferWorks(admin.userId, input));
});
