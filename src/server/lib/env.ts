// 生产启动自检：弱密钥/默认密钥/危险支付模式在生产直接 fail-fast，
// 杜绝「env 注入失败时带着源码里的默认值静默启动」（AUTH_SECRET 回退值签 JWT =
// 任何人可伪造登录态；PAYMENT_MODE 缺省 mock = 免费打款）。
// 纯模块无 Next 依赖：app 容器经 src/instrumentation.ts 调用，worker 容器
// （tsx 直启 scheduler.ts）在入口调用。dev/test 环境（NODE_ENV≠production）跳过。
import { logger } from './logger';

/** 已知弱值：源码回退值 / .env.example 占位值 / 测试密钥 */
const WEAK_VALUES = new Set([
  'dev-secret-32-bytes-minimum-length',
  'test-secret-32-bytes-minimum-length',
  'change-me-please-32-bytes-min',
  'change-me-pepper',
  'minioadmin',
]);

export interface EnvIssue {
  key: string;
  problem: string;
}

export function collectEnvIssues(): EnvIssue[] {
  const issues: EnvIssue[] = [];

  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret || authSecret.length < 32 || WEAK_VALUES.has(authSecret)) {
    issues.push({ key: 'AUTH_SECRET', problem: '缺失 / 长度不足 32 / 为已知默认值' });
  }

  const pepper = process.env.PASSWORD_PEPPER;
  if (!pepper || WEAK_VALUES.has(pepper)) {
    issues.push({ key: 'PASSWORD_PEPPER', problem: '缺失 / 为已知默认值' });
  }

  // 注意：S3_ACCESS_KEY 不做值校验——生产即用 minioadmin 用户名配强 SECRET_KEY
  const s3Secret = process.env.S3_SECRET_KEY;
  if (!s3Secret || WEAK_VALUES.has(s3Secret)) {
    issues.push({ key: 'S3_SECRET_KEY', problem: '缺失 / 为 minioadmin 默认值' });
  }

  // PAYMENT_MODE 未设置时代码默认 mock（payments.ts ?? 'mock'），生产等于免费打款
  const payMode = process.env.PAYMENT_MODE;
  if (payMode !== 'off' && payMode !== 'epay') {
    issues.push({
      key: 'PAYMENT_MODE',
      problem: `生产仅允许 off|epay（当前: ${payMode ?? '未设置，代码默认 mock'}）`,
    });
  }

  return issues;
}

/** 生产环境启动断言：存在任何问题直接抛错终止启动（crash 优于带默认密钥运行） */
export function assertProdEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const issues = collectEnvIssues();
  if (issues.length) {
    for (const i of issues) logger.error(i, '生产环境配置校验失败');
    throw new Error(`生产环境配置校验失败：${issues.map((i) => i.key).join(', ')}（详见上方日志）`);
  }
  logger.info(
    '生产环境配置校验通过（AUTH_SECRET / PASSWORD_PEPPER / S3_SECRET_KEY / PAYMENT_MODE）',
  );
}
