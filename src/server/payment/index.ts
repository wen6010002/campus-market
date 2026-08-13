// 支付提供方抽象（BACKEND.md §10.1）
import type { PayMethod } from '@/lib/constants';
import { mockProvider } from './mock';
import { wechatProvider } from './wechat';
import { alipayProvider } from './alipay';

export type PayParams =
  | { provider: 'wechat'; codeUrl?: string; mwebUrl?: string }
  | { provider: 'alipay'; redirectUrl: string }
  | { provider: 'mock'; paid: true };

export interface NotifyResult {
  orderId: string; // 商户订单号（我方 Order.id）
  transactionId: string; // 第三方流水
  paid: boolean;
}

export interface OrderSnapshot {
  id: string;
  amount: number;
  payMethod: PayMethod;
}

export interface PayProvider {
  /** 拉起支付：返回前端拉起参数（mock 返回 paid:true） */
  createOrder(order: OrderSnapshot): Promise<PayParams>;
  /** 验签 + 解析回调（失败抛错） */
  verifyNotify(req: Request): Promise<NotifyResult>;
  /** 主动查单 */
  queryOrder(outTradeNo: string): Promise<'PAID' | 'PENDING' | 'CLOSED' | 'FAILED'>;
  /** 应答字符串（回调后返回给支付方） */
  ack(): { body: string; contentType: string };
}

export function getProvider(method: PayMethod): PayProvider {
  const mode = process.env.PAYMENT_MODE ?? 'mock';
  if (mode === 'mock' || method === 'MOCK') return mockProvider;
  if (method === 'WECHAT') return wechatProvider;
  if (method === 'ALIPAY') return alipayProvider;
  return mockProvider;
}
