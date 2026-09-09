import { describe, expect, it } from 'vitest';
import { assertSameOrigin } from '@/server/lib/http';

// CSRF 同源校验：strict 模式（敏感路由）与默认模式的边界
describe('assertSameOrigin CSRF 校验', () => {
  const post = (headers: Record<string, string>) =>
    new Request('https://kedahub.cn/api/v1/auth/change-password', {
      method: 'POST',
      headers,
    });

  it('GET/HEAD 一律跳过（不校验）', () => {
    expect(() =>
      assertSameOrigin(new Request('https://kedahub.cn/api/v1/works'), { strict: true }),
    ).not.toThrow();
  });

  it('同源 Origin：默认与 strict 均放行', () => {
    const req = post({ origin: 'https://kedahub.cn' });
    expect(() => assertSameOrigin(req)).not.toThrow();
    expect(() => assertSameOrigin(req, { strict: true })).not.toThrow();
  });

  it('跨源 Origin：默认与 strict 均拒绝', () => {
    const req = post({ origin: 'https://evil.example' });
    expect(() => assertSameOrigin(req)).toThrow();
    expect(() => assertSameOrigin(req, { strict: true })).toThrow();
  });

  it('无 Origin/Referer：默认放行（curl 兼容），strict 拒绝（敏感路由）', () => {
    const req = post({});
    expect(() => assertSameOrigin(req)).not.toThrow();
    expect(() => assertSameOrigin(req, { strict: true })).toThrow();
  });

  it('同源 Referer 兜底：Origin 缺失时 Referer 参与比对', () => {
    const req = post({ referer: 'https://kedahub.cn/works' });
    expect(() => assertSameOrigin(req, { strict: true })).not.toThrow();
  });

  it('非法 Origin 值：URL 解析失败即拒绝', () => {
    expect(() => assertSameOrigin(post({ origin: '::::not-a-url' }))).toThrow();
  });
});
