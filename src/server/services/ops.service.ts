import { prisma } from '../db';
import { redis } from '../lib/redis';
import { storageHealth } from '../storage/minio';

type ServiceState = 'ok' | 'error';

async function probe(check: () => Promise<unknown>) {
  const started = Date.now();
  try {
    await check();
    return { state: 'ok' as ServiceState, latencyMs: Date.now() - started };
  } catch {
    return { state: 'error' as ServiceState, latencyMs: Date.now() - started };
  }
}

export const opsService = {
  /** 仅供后台运维面板读取；不返回连接串、密钥、容器控制信息或原始日志。 */
  async overview() {
    const [database, cache, storage, users, works, pendingWorks, openReports, orders] =
      await Promise.all([
        probe(() => prisma.$queryRaw`SELECT 1`),
        probe(() => redis.ping()),
        probe(() => storageHealth()),
        prisma.user.count(),
        prisma.work.count({ where: { deletedAt: null } }),
        prisma.work.count({ where: { status: 'PENDING', deletedAt: null } }),
        prisma.report.count({ where: { status: 'OPEN' } }),
        prisma.order.count(),
      ]);

    const services = [
      { name: '应用服务', state: 'ok' as ServiceState, latencyMs: null },
      { name: 'PostgreSQL', ...database },
      { name: 'Redis', ...cache },
      { name: 'MinIO 文件存储', ...storage },
    ];

    return {
      generatedAt: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      services,
      metrics: { users, works, pendingWorks, openReports, orders },
    };
  },
};
