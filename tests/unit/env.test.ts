import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectEnvIssues, assertProdEnv } from '@/server/lib/env';

// 生产环境自检：规则正反例 + NODE_ENV 分支行为
describe('生产环境配置自检', () => {
  const KEYS = [
    'AUTH_SECRET',
    'PASSWORD_PEPPER',
    'S3_SECRET_KEY',
    'S3_ACCESS_KEY',
    'PAYMENT_MODE',
    'DEEPSEEK_API_KEY',
    'NODE_ENV',
  ] as const;
  // Next 类型把 NODE_ENV 声明为 readonly，测试里需要改写，走宽松映射
  const setEnv = (k: string, v: string | undefined) => {
    const env = process.env as Record<string, string | undefined>;
    if (v === undefined) delete env[k];
    else env[k] = v;
  };
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  });
  afterEach(() => {
    for (const k of KEYS) setEnv(k, saved[k]);
  });

  const setGood = () => {
    setEnv('AUTH_SECRET', 'a'.repeat(48));
    setEnv('PASSWORD_PEPPER', 'strong-pepper-9f8e7d6c5b4a');
    setEnv('S3_SECRET_KEY', 'strong-s3-secret-1234567890ab');
    setEnv('S3_ACCESS_KEY', 'minioadmin'); // 生产合法：用户名默认但密钥强
    setEnv('PAYMENT_MODE', 'off');
    setEnv('DEEPSEEK_API_KEY', 'sk-test-moderation-key'); // V12 评论 AI 审核
  };

  it('生产同款配置（含 S3_ACCESS_KEY=minioadmin）→ 零问题', () => {
    setGood();
    expect(collectEnvIssues()).toEqual([]);
  });

  it('PAYMENT_MODE=epay 同样合法', () => {
    setGood();
    setEnv('PAYMENT_MODE', 'epay');
    expect(collectEnvIssues()).toEqual([]);
  });

  it('AUTH_SECRET：缺失 / 过短 / 源码默认值均拦截', () => {
    setGood();
    setEnv('AUTH_SECRET', undefined);
    expect(collectEnvIssues().map((i) => i.key)).toContain('AUTH_SECRET');
    setEnv('AUTH_SECRET', 'short');
    expect(collectEnvIssues().map((i) => i.key)).toContain('AUTH_SECRET');
    setEnv('AUTH_SECRET', 'dev-secret-32-bytes-minimum-length');
    expect(collectEnvIssues().map((i) => i.key)).toContain('AUTH_SECRET');
  });

  it('S3_SECRET_KEY=minioadmin 拦截；S3_ACCESS_KEY=minioadmin 不拦截', () => {
    setGood();
    setEnv('S3_SECRET_KEY', 'minioadmin');
    expect(collectEnvIssues().map((i) => i.key)).toContain('S3_SECRET_KEY');
    expect(collectEnvIssues().map((i) => i.key)).not.toContain('S3_ACCESS_KEY');
  });

  it('PAYMENT_MODE：mock 与未设置（代码默认 mock）均拦截', () => {
    setGood();
    setEnv('PAYMENT_MODE', 'mock');
    expect(collectEnvIssues().map((i) => i.key)).toContain('PAYMENT_MODE');
    setEnv('PAYMENT_MODE', undefined);
    expect(collectEnvIssues().map((i) => i.key)).toContain('PAYMENT_MODE');
  });

  it('DEEPSEEK_API_KEY：缺失拦截（V12 审核 fail-fast）', () => {
    setGood();
    setEnv('DEEPSEEK_API_KEY', undefined);
    expect(collectEnvIssues().map((i) => i.key)).toContain('DEEPSEEK_API_KEY');
  });

  it('assertProdEnv：production 坏配置抛错，好配置通过', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('AUTH_SECRET', undefined);
    expect(() => assertProdEnv()).toThrow('生产环境配置校验失败');
    setGood();
    expect(() => assertProdEnv()).not.toThrow();
  });

  it('assertProdEnv：非 production 环境（test/dev）坏配置也不抛', () => {
    setEnv('NODE_ENV', 'test');
    setEnv('AUTH_SECRET', undefined);
    expect(() => assertProdEnv()).not.toThrow();
  });
});
