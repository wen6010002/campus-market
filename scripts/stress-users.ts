// 压测账号生成：直接写库创建 N 个 stress 账号（幂等，可重复执行）。
// 用法（在 migrate 容器内）：pnpm tsx scripts/stress-users.ts [数量=60]
// 账号：stress001@szu.edu.cn .. stressNNN@szu.edu.cn，统一密码 Stress1234
import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../src/server/auth/password';

const prisma = new PrismaClient();

export const STRESS_PASSWORD = 'Stress1234';

async function main() {
  const n = Number(process.argv[2] ?? 60);
  const hash = await hashPassword(STRESS_PASSWORD);
  let created = 0;

  for (let i = 1; i <= n; i++) {
    const id = `su_${String(i).padStart(3, '0')}`;
    const email = `stress${String(i).padStart(3, '0')}@szu.edu.cn`;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      await prisma.user.create({
        data: {
          id,
          email,
          username: `压测用户${String(i).padStart(3, '0')}`,
          passwordHash: hash,
          role: Role.STUDENT,
          avatarColor: '#5B8DEF',
          student: {
            create: {
              eduEmail: email,
              school: '深圳大学',
              college: '压测学院',
              major: '压测专业',
              grade: '-',
              verifyStatus: 'VERIFIED',
              verifiedAt: new Date(),
            },
          },
        },
      });
      created++;
    }
  }

  const total = await prisma.user.count({ where: { id: { startsWith: 'su_' } } });
  console.log(`压测账号就绪：新建 ${created}，共 ${total}（stress001@szu.edu.cn / ${STRESS_PASSWORD}）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
