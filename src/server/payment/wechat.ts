import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { appError } from '../lib/errors';
import { rsaSign, rsaVerify, aesGcmDecrypt } from './crypto';
import type { PayProvider, PayParams, NotifyResult, OrderSnapshot, RefundInput } from './index';

// 微信支付 v3（Native）。本地/E2E 用 mock；真实下单在部署时注入商户号/证书/回调地址。
const APPID = process.env.WECHAT_APPID ?? '';
const MCHID = process.env.WECHAT_MCHID ?? '';
const API_V3_KEY = process.env.WECHAT_API_V3_KEY ?? '';
const SERIAL_NO = process.env.WECHAT_SERIAL_NO ?? '';
const PRIVATE_KEY_PATH = process.env.WECHAT_PRIVATE_KEY_PATH ?? './certs/wechat.pem';
const PLATFORM_CERT_PATH = process.env.WECHAT_PLATFORM_CERT_PATH ?? '';
const NOTIFY_URL = process.env.WECHAT_NOTIFY_URL ?? '';
const API_BASE = 'https://api.mch.weixin.qq.com';

function privateKey(): string {
  try {
    return readFileSync(PRIVATE_KEY_PATH, 'utf8');
  } catch {
    return '';
  }
}

/** 构建待签名串（微信 v3 规范：method\npath\ntimestamp\nnonce\nbody\n） */
export function buildWechatMessage(
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  body: string,
): string {
  return `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;
}

/** 发 HTTPS 请求到微信 API，自动构建 Authorization 签名头 */
async function wechatRequest(method: string, path: string, body: unknown): Promise<any> {
  const bodyStr = JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomUUID();
  const message = buildWechatMessage(method, path, timestamp, nonce, bodyStr);
  const signature = rsaSign(message, privateKey());
  const authorization =
    `WECHATPAY2-SHA256-RSA2048 mchid="${MCHID}",nonce_str="${nonce}",` +
    `signature="${signature}",timestamp="${timestamp}",serial_no="${SERIAL_NO}"`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authorization,
      'User-Agent': 'campus-market/2.0',
    },
    body: bodyStr,
  });

  const text = await res.text();
  if (!res.ok) {
    throw appError('INTERNAL', `微信支付请求失败 ${res.status}: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text || '{}');
}

export const wechatProvider: PayProvider = {
  async createOrder(order: OrderSnapshot): Promise<PayParams> {
    if (!MCHID || !APPID || !SERIAL_NO || !privateKey() || !NOTIFY_URL) {
      throw appError(
        'INTERNAL',
        '微信支付未配置（WECHAT_MCHID/WECHAT_APPID/WECHAT_SERIAL_NO/私钥/回调地址）',
      );
    }
    const data = await wechatRequest('POST', '/v3/pay/transactions/native', {
      appid: APPID,
      mchid: MCHID,
      description: order.title,
      out_trade_no: order.id,
      notify_url: NOTIFY_URL,
      amount: { total: Math.round(order.amount * 100), currency: 'CNY' },
    });
    if (!data.code_url) throw appError('INTERNAL', '微信下单未返回 code_url');
    return { provider: 'wechat', codeUrl: data.code_url };
  },

  async verifyNotify(req: Request): Promise<NotifyResult> {
    // 生产必须验签，不留跳过分支
    if (!PLATFORM_CERT_PATH) throw appError('FORBIDDEN', '微信平台证书未配置');
    const cert = readFileSync(PLATFORM_CERT_PATH, 'utf8');
    const body = await req.json();
    const headers = req.headers;
    const msg = `${headers.get('wechatpay-timestamp')}\n${headers.get('wechatpay-nonce')}\n${JSON.stringify(body.resource)}\n`;
    if (!rsaVerify(msg, headers.get('wechatpay-signature') ?? '', cert)) {
      throw appError('FORBIDDEN', '微信回调验签失败');
    }

    const resource = body?.resource;
    if (!resource?.ciphertext || !API_V3_KEY)
      throw appError('VALIDATION', '回调缺少 resource 或 APIv3 key');

    const decrypted = aesGcmDecrypt(resource.ciphertext, API_V3_KEY);
    const data = JSON.parse(decrypted);
    return {
      orderId: data.out_trade_no,
      transactionId: data.transaction_id,
      paid: data.trade_state === 'SUCCESS',
    };
  },

  async queryOrder(outTradeNo: string): Promise<'PAID' | 'PENDING' | 'CLOSED' | 'FAILED'> {
    if (!MCHID || !SERIAL_NO || !privateKey()) return 'PENDING';
    const data = await wechatRequest(
      'GET',
      `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${MCHID}`,
      null,
    );
    const state = data?.trade_state as string;
    if (state === 'SUCCESS') return 'PAID';
    if (state === 'NOTPAY' || state === 'USERPAYING') return 'PENDING';
    if (state === 'CLOSED' || state === 'REVOKED') return 'CLOSED';
    return 'FAILED';
  },

  async refund(input: RefundInput): Promise<{ refundId: string }> {
    if (!MCHID || !SERIAL_NO || !privateKey()) {
      throw appError('INTERNAL', '微信支付未配置');
    }
    const data = await wechatRequest('POST', '/v3/refund/domestic/refunds', {
      out_trade_no: input.orderId,
      out_refund_no: `refund-${input.orderId}-${Date.now()}`,
      reason: input.reason ?? '用户退款',
      amount: {
        refund: Math.round(input.amount * 100),
        total: Math.round(input.amount * 100),
        currency: 'CNY',
      },
    });
    return { refundId: data?.refund_id ?? `wechat-refund-${input.orderId}` };
  },

  ack() {
    return {
      body: JSON.stringify({ code: 'SUCCESS', message: '成功' }),
      contentType: 'application/json',
    };
  },
};
