import { describe, it, expect } from 'vitest';
import { sanitize } from '@/server/lib/sanitize';
import { assertSameOrigin } from '@/server/lib/http';

describe('XSS 清洗（sanitize-html 白名单）', () => {
  it('剥离 <script>', () => {
    expect(sanitize('<script>alert(1)</script>你好')).toBe('你好');
  });
  it('保留 b/strong/i/em/br', () => {
    expect(sanitize('<b>加粗</b>正常<em>斜体</em><br>换行')).toBe(
      '<b>加粗</b>正常<em>斜体</em><br />换行',
    );
  });
  it('剥离 img 与事件属性', () => {
    expect(sanitize('<img src=x onerror=alert(1)>')).toBe('');
    expect(sanitize('<a href="javascript:alert(1)">x</a>')).toBe('x');
  });
});

describe('CSRF 同源校验', () => {
  it('GET 请求跳过校验', () => {
    expect(() =>
      assertSameOrigin(new Request('http://localhost:3000/api/v1/works', { method: 'GET' })),
    ).not.toThrow();
  });
  it('跨源 POST 被拒', () => {
    const req = new Request('http://localhost:3000/api/v1/works', {
      method: 'POST',
      headers: { origin: 'https://evil.com' },
    });
    expect(() => assertSameOrigin(req)).toThrow();
  });
  it('无 Origin/Referer 放行（curl/服务端调用）', () => {
    const req = new Request('http://localhost:3000/api/v1/works', { method: 'POST' });
    expect(() => assertSameOrigin(req)).not.toThrow();
  });
  it('同 Host 放行（V3 修复：127.0.0.1 等任意访问主机，不再依赖固定 APP_BASE_URL）', () => {
    const req = new Request('http://127.0.0.1:3000/api/v1/auth/logout', {
      method: 'POST',
      headers: { origin: 'http://127.0.0.1:3000' },
    });
    expect(() => assertSameOrigin(req)).not.toThrow();
  });
  it('Host 不同被拒（含端口差异）', () => {
    const req = new Request('http://localhost:3000/api/v1/auth/logout', {
      method: 'POST',
      headers: { origin: 'http://127.0.0.1:3000' },
    });
    expect(() => assertSameOrigin(req)).toThrow();
  });
  it('反代场景取 x-forwarded-host 判定', () => {
    const req = new Request('http://internal:3000/api/v1/auth/logout', {
      method: 'POST',
      headers: { origin: 'https://campus.example.com', 'x-forwarded-host': 'campus.example.com' },
    });
    expect(() => assertSameOrigin(req)).not.toThrow();
  });
});
