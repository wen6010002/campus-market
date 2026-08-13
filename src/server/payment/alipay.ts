import { appError } from '../lib/errors';
import { rsaSign, rsaVerify } from './crypto';
import type { PayProvider, PayParams, NotifyResult, OrderSnapshot } from './index';

// 支付宝电脑网站支付（RSA2）。本地/E2E 用 mock，真实下单需在部署时提供应用私钥/支付宝公钥。
const APP_ID = process.env.ALIPAY_APP_ID ?? '';
const PRIVATE_KEY = process.env.ALIPAY_PRIVATE_KEY ?? '';
const PUBLIC_KEY = process.env.ALIPAY_PUBLIC_KEY ?? '';

export const alipayProvider: PayProvider = {
  async createOrder(order: OrderSnapshot): Promise<PayParams> {
    if (!APP_ID || !PRIVATE_KEY) {
      throw appError('INTERNAL', '支付宝未配置（ALIPAY_APP_ID/ALIPAY_PRIVATE_KEY）');
    }
    // 生产：构建 alipay.trade.page.pay 表单，sign=RSA2(待签内容)。此处返回占位跳转 URL。
    void rsaSign;
    return {
      provider: 'alipay',
      redirectUrl: `https://openapi.alipay.com/gateway.do?app_id=${APP_ID}&out_trade_no=${order.id}`,
    };
  },

  async verifyNotify(req: Request): Promise<NotifyResult> {
    const form = new URLSearchParams(await req.text());
    const sign = form.get('sign') ?? '';
    // RSA2 验签：去除 sign/sign_type 后按字母序拼 k=v&... 作为待签串
    const entries = [...form.entries()]
      .filter(([k]) => k !== 'sign' && k !== 'sign_type')
      .sort(([a], [b]) => a.localeCompare(b));
    const message = entries.map(([k, v]) => `${k}=${v}`).join('&');
    if (PUBLIC_KEY && !rsaVerify(message, sign, PUBLIC_KEY)) {
      throw appError('FORBIDDEN', '支付宝回调验签失败');
    }
    return {
      orderId: form.get('out_trade_no') ?? '',
      transactionId: form.get('trade_no') ?? '',
      paid:
        form.get('trade_status') === 'TRADE_SUCCESS' ||
        form.get('trade_status') === 'TRADE_FINISHED',
    };
  },

  async queryOrder(): Promise<'PAID' | 'PENDING' | 'CLOSED' | 'FAILED'> {
    return 'PENDING';
  },

  ack() {
    return { body: 'success', contentType: 'text/plain' };
  },
};
