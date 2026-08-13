import { readFileSync } from 'node:fs';
import { appError } from '../lib/errors';
import { rsaSign, rsaVerify, aesGcmDecrypt } from './crypto';
import type { PayProvider, PayParams, NotifyResult, OrderSnapshot } from './index';

// 微信支付 v3（Native）。本地/E2E 用 mock，真实下单需在部署时提供商户号/证书。
const APPID = process.env.WECHAT_APPID ?? '';
const MCHID = process.env.WECHAT_MCHID ?? '';
const API_V3_KEY = process.env.WECHAT_API_V3_KEY ?? '';
const PRIVATE_KEY_PATH = process.env.WECHAT_PRIVATE_KEY_PATH ?? './certs/wechat.pem';
const PLATFORM_CERT_PATH = process.env.WECHAT_PLATFORM_CERT_PATH ?? '';

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

export const wechatProvider: PayProvider = {
  async createOrder(order: OrderSnapshot): Promise<PayParams> {
    if (!MCHID || !APPID || !privateKey()) {
      throw appError('INTERNAL', '微信支付未配置（WECHAT_MCHID/WECHAT_APPID/私钥）');
    }
    // 生产：POST /v3/pay/transactions/native，Authorization 用 rsaSign(buildWechatMessage(...))。
    // 此处返回占位 codeUrl；真实下单在部署时用 fetch 调用微信接口。
    void rsaSign; // 保留签名函数引用
    return { provider: 'wechat', codeUrl: `weixin://wxpay/bizpayurl?pr=${order.id}` };
  },

  async verifyNotify(req: Request): Promise<NotifyResult> {
    const body = await req.json();
    const headers = req.headers;

    // 验签（平台证书可用时校验 Wechatpay-Signature）
    if (PLATFORM_CERT_PATH) {
      try {
        const cert = readFileSync(PLATFORM_CERT_PATH, 'utf8');
        const msg = `${headers.get('wechatpay-timestamp')}\n${headers.get('wechatpay-nonce')}\n${JSON.stringify(body.resource)}\n`;
        if (!rsaVerify(msg, headers.get('wechatpay-signature') ?? '', cert)) {
          throw appError('FORBIDDEN', '微信回调验签失败');
        }
      } catch {
        throw appError('FORBIDDEN', '微信回调验签失败');
      }
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

  async queryOrder(): Promise<'PAID' | 'PENDING' | 'CLOSED' | 'FAILED'> {
    return 'PENDING';
  },

  ack() {
    return {
      body: JSON.stringify({ code: 'SUCCESS', message: '成功' }),
      contentType: 'application/json',
    };
  },
};
