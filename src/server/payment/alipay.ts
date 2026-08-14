import { appError } from '../lib/errors';
import { rsaSign, rsaVerify } from './crypto';
import type { PayProvider, PayParams, NotifyResult, OrderSnapshot, RefundInput } from './index';

// 支付宝电脑网站支付（RSA2）。本地/E2E 用 mock，真实下单需注入应用私钥/支付宝公钥。
const APP_ID = process.env.ALIPAY_APP_ID ?? '';
const PRIVATE_KEY = process.env.ALIPAY_PRIVATE_KEY ?? '';
const PUBLIC_KEY = process.env.ALIPAY_PUBLIC_KEY ?? '';
const NOTIFY_URL = process.env.ALIPAY_NOTIFY_URL ?? '';
const GATEWAY = 'https://openapi.alipay.com/gateway.do';

function alipayTime(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 支付宝待签串：参数（除 sign/sign_type）按 key ASCII 升序，拼 k=v&k=v（值不 URL encode） */
export function buildAlipayMessage(params: Record<string, string>): string {
  return Object.entries(params)
    .filter(([k]) => k !== 'sign' && k !== 'sign_type')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

/** 发请求到支付宝网关（RSA2 签名） */
async function alipayRequest(method: string, bizContent: Record<string, unknown>): Promise<any> {
  if (!APP_ID || !PRIVATE_KEY)
    throw appError('INTERNAL', '支付宝未配置（ALIPAY_APP_ID/ALIPAY_PRIVATE_KEY）');
  const params: Record<string, string> = {
    app_id: APP_ID,
    method,
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: alipayTime(),
    version: '1.0',
    biz_content: JSON.stringify(bizContent),
  };
  const sign = rsaSign(buildAlipayMessage(params), PRIVATE_KEY);
  const form = new URLSearchParams({ ...params, sign });
  const res = await fetch(GATEWAY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const text = await res.text();
  return JSON.parse(text || '{}');
}

export const alipayProvider: PayProvider = {
  async createOrder(order: OrderSnapshot): Promise<PayParams> {
    if (!APP_ID || !PRIVATE_KEY) {
      throw appError('INTERNAL', '支付宝未配置（ALIPAY_APP_ID/ALIPAY_PRIVATE_KEY）');
    }
    const bizContent = {
      out_trade_no: order.id,
      total_amount: order.amount.toFixed(2),
      subject: order.title,
      product_code: 'FAST_INSTANT_TRADE_PAY',
    };
    const params: Record<string, string> = {
      app_id: APP_ID,
      method: 'alipay.trade.page.pay',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: alipayTime(),
      version: '1.0',
      notify_url: NOTIFY_URL,
      return_url: NOTIFY_URL,
      biz_content: JSON.stringify(bizContent),
    };
    const sign = rsaSign(buildAlipayMessage(params), PRIVATE_KEY);
    const query = Object.entries({ ...params, sign })
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    return { provider: 'alipay', redirectUrl: `${GATEWAY}?${query}` };
  },

  async verifyNotify(req: Request): Promise<NotifyResult> {
    const form = new URLSearchParams(await req.text());
    const sign = form.get('sign') ?? '';
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

  async queryOrder(outTradeNo: string): Promise<'PAID' | 'PENDING' | 'CLOSED' | 'FAILED'> {
    if (!APP_ID || !PRIVATE_KEY) return 'PENDING';
    const data = await alipayRequest('alipay.trade.query', { out_trade_no: outTradeNo });
    const resp = data?.alipay_trade_query_response;
    const state = resp?.trade_status as string;
    if (state === 'TRADE_SUCCESS' || state === 'TRADE_FINISHED') return 'PAID';
    if (state === 'WAIT_BUYER_PAY') return 'PENDING';
    if (state === 'TRADE_CLOSED') return 'CLOSED';
    return 'FAILED';
  },

  async refund(input: RefundInput): Promise<{ refundId: string }> {
    if (!APP_ID || !PRIVATE_KEY) throw appError('INTERNAL', '支付宝未配置');
    const data = await alipayRequest('alipay.trade.refund', {
      out_trade_no: input.orderId,
      refund_amount: input.amount.toFixed(2),
      refund_reason: input.reason ?? '用户退款',
      out_request_no: `refund-${input.orderId}-${Date.now()}`,
    });
    const resp = data?.alipay_trade_refund_response;
    if (resp?.code === '10000') return { refundId: `${resp.trade_no}` };
    throw appError('INTERNAL', `支付宝退款失败: ${resp?.sub_msg ?? resp?.msg ?? ''}`);
  },

  ack() {
    return { body: 'success', contentType: 'text/plain' };
  },
};
