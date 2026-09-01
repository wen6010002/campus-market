import { z } from 'zod';
import { ok, readJson, withErrorHandler } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { adminService } from '@/server/services/admin.service';

const testerSchema = z.object({
  email: z.string().trim().email().max(120),
  username: z.string().trim().min(2).max(30),
  password: z
    .string()
    .min(12, '测试账号密码至少 12 位')
    .regex(/^(?=.*[a-zA-Z])(?=.*\d)/, '密码需同时包含字母和数字'),
});

export const POST = withErrorHandler(async (req: Request) => {
  await requireAdmin();
  const input = testerSchema.parse(await readJson(req));
  return ok(await adminService.createBackofficeTester(input), { status: 201 });
});
