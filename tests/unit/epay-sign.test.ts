import { describe, it, expect } from 'vitest';
import { buildEpayMessage, md5Sign, truncateBytes } from '@/server/payment/epay';

// 期望向量独立于被测实现预生成（PHP 示例算法同构：ksort + 拼接 + 尾接 key + md5 小写）
const TEST_KEY = 'test-pay-key-2026';

describe('码支付 MD5 签名（V6）', () => {
  it('待签串：ASCII 升序 + 排除 sign/sign_type/a/c/m/s/空值 + 值不 URL 编码（中文与空格原样）', () => {
    const msg = buildEpayMessage({
      pid: '1148',
      type: 'alipay',
      out_trade_no: 'ord_test_1',
      notify_url: 'https://kedahub.cn/api/v1/webhooks/pay/epay',
      return_url: 'https://kedahub.cn/pay/result',
      name: '数据结构 复习资料',
      money: '49.90',
      sign: 'IGNOREME',
      sign_type: 'MD5',
      a: 'A',
      c: 'C',
      m: 'M',
      s: 'S',
      empty: '',
    } as Record<string, string>);
    expect(msg).toBe(
      'money=49.90&name=数据结构 复习资料&notify_url=https://kedahub.cn/api/v1/webhooks/pay/epay&out_trade_no=ord_test_1&pid=1148&return_url=https://kedahub.cn/pay/result&type=alipay',
    );
  });

  it('签名 = md5(待签串 + key) 直接拼接，hex 小写（固定向量）', () => {
    const msg = buildEpayMessage({
      money: '49.90',
      name: '数据结构 复习资料',
      notify_url: 'https://kedahub.cn/api/v1/webhooks/pay/epay',
      out_trade_no: 'ord_test_1',
      pid: '1148',
      return_url: 'https://kedahub.cn/pay/result',
      type: 'alipay',
    });
    expect(md5Sign(msg, TEST_KEY)).toBe('8b7149917b58de268745ac05841c113a');
    expect(md5Sign(msg, TEST_KEY)).toMatch(/^[0-9a-f]{32}$/); // 小写
    expect(md5Sign(msg, 'wrong-key')).not.toBe('8b7149917b58de268745ac05841c113a');
  });

  it('空参数集：待签串为空串，签名 = md5(key)', () => {
    expect(buildEpayMessage({})).toBe('');
    // md5('test-pay-key-2026') 固定向量
    expect(md5Sign('', TEST_KEY)).toBe('c83e9f531f1b1b3406cc9802ca067c68');
  });

  it('name 按字节截断（UTF-8 中文 3 字节/字，不产生半个字符）', () => {
    expect(truncateBytes('abc', 5)).toBe('abc');
    expect(truncateBytes('数据结构复习资料', 12)).toBe('数据结构'); // 4 字 × 3B = 12B，第 5 字放不下
    const cut = truncateBytes('资料资料', 7); // 7B = 2字 + 1个被割字节 → 去掉替换符剩 2 字
    expect(Buffer.byteLength(cut, 'utf8')).toBeLessThanOrEqual(7);
    expect(cut).not.toContain('�');
  });
});
