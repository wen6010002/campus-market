// 支付提供方抽象（BACKEND.md §10.1）。V6：仅码支付（epay，支付宝收款）+ mock；微信收款已下线
// （PayMethod 常量保留 WECHAT 供提现 Payout 链路使用）。
import type { PayMethod } from '@/lib/constants';
import { appError } from '../lib/errors';
import { mockProvider } from './mock';
import { epayProvider } from './epay';

export type PayParams =
  { provider: 'alipay'; redirectUrl: string } | { provider: 'mock'; paid: true };

export interface NotifyResult {
  orderId: string; // 商户订单号（我方 Order.id）
  transactionId: string; // 第三方流水
  paid: boolean;
  paidAmount?: string; // 元（回调带金额的通道填，markPaid 与订单比对）
}

export interface QueryResult {
  status: 'PAID' | 'PENDING' | 'CLOSED' | 'FAILED';
  tradeNo?: string;
}

export interface OrderSnapshot {
  id: string;
  amount: number;
  title: string; // 商品标题（下单 body 的 description/subject）
  payMethod: PayMethod;
}

export interface RefundInput {
  orderId: string; // 商户订单号
  transactionId: string; // 第三方流水
  amount: number; // 退款金额（元）
  reason?: string;
}

export interface PayProvider {
  /** 拉起支付：返回前端拉起参数（mock 返回 paid:true） */
  createOrder(order: OrderSnapshot): Promise<PayParams>;
  /** 验签 + 解析回调（失败抛错） */
  verifyNotify(req: Request): Promise<NotifyResult>;
  /** 主动查单 */
  queryOrder(outTradeNo: string): Promise<QueryResult>;
  /** 退款（epay 通道不支持，抛错） */
  refund(input: RefundInput): Promise<{ refundId: string }>;
  /** 应答字符串（回调后返回给支付方） */
  ack(): { body: string; contentType: string };
}

export function getProvider(method: PayMethod): PayProvider {
  const mode = process.env.PAYMENT_MODE ?? 'mock';
  if (mode === 'mock' || method === 'MOCK') return mockProvider;
  if (method === 'ALIPAY') return epayProvider;
  // 兜底不落 mock（否则未知/已下线方式会免费送结算）
  throw appError('VALIDATION', '该支付方式已下线');
}
