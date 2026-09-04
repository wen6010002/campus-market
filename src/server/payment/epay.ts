import { createHash } from 'node:crypto';
import { appError } from '../lib/errors';
import { logger } from '../lib/logger';
import { cacheGet, cacheSet } from '../lib/cache';
import type { PayProvider, PayParams, NotifyResult, OrderSnapshot, QueryResult } from './index';

/**
 * 码支付网关（易支付协议，V6）：仅支付宝收款。
 * 下单 POST mapi.php → payurl 跳转；异步通知 GET + MD5 验签（应答纯文本 success）；
 * 查单 GET api.php?act=order（status=1 已付）。无退款 API（商户后台人工）。
 * env 惰性读取（集成测试需 stubEnv 后动态 import，不能在模块加载时固化）。
 */
const gateway = () => process.env.EPAY_GATEWAY ?? 'https://pay.fengxiaonb.icu';
const pid = () => process.env.EPAY_PID ?? '';
const key = () => process.env.EPAY_KEY ?? '';
const notifyUrl = () =>
  process.env.EPAY_NOTIFY_URL ?? `${process.env.APP_BASE_URL ?? ''}/api/v1/webhooks/pay/epay`;
const returnUrl = () =>
  process.env.EPAY_RETURN_URL ?? `${process.env.APP_BASE_URL ?? ''}/pay/result`;

/** 参与签名的排除项：sign/sign_type、空值，及易支付历史字段 a/c/m/s（对齐平台 PHP makeSign） */
const SIGN_EXCLUDED = new Set(['sign', 'sign_type', 'a', 'c', 'm', 's']);

/** 待签串：key 原生 ASCII 升序（不用 localeCompare，避免本地化排序差异），拼 k=v&…，值不做 URL 编码 */
export function buildEpayMessage(params: Record<string, string | undefined>): string {
  return Object.entries(params)
    .filter(([k, v]) => !SIGN_EXCLUDED.has(k) && v !== undefined && v !== '')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

/** sign = md5(待签串 + 商户key)，直接拼接无分隔符，hex 小写 */
export function md5Sign(message: string, payKey: string): string {
  return createHash('md5')
    .update(message + payKey, 'utf8')
    .digest('hex');
}

/** 按字节截断（UTF-8 中文 3 字节/字，不能按 string.length 截） */
export function truncateBytes(s: string, maxBytes: number): string {
  const buf = Buffer.from(s, 'utf8');
  if (buf.length <= maxBytes) return s;
  return buf.subarray(0, maxBytes).toString('utf8').replace(/�$/, ''); // 割半个字去掉替换符
}

export const epayProvider: PayProvider = {
  async createOrder(order: OrderSnapshot): Promise<PayParams> {
    if (!pid() || !key()) throw appError('INTERNAL', '支付网关未配置（EPAY_PID/EPAY_KEY）');

    // payurl 微缓存 60s：防双击重复向网关提交同 out_trade_no
    const cached = await cacheGet<string>(`epay:payurl:${order.id}`);
    if (cached) return { provider: 'alipay', redirectUrl: cached };

    const params: Record<string, string> = {
      pid: pid(),
      type: 'alipay',
      out_trade_no: order.id,
      notify_url: notifyUrl(),
      return_url: returnUrl(),
      name: truncateBytes(order.title, 100),
      money: order.amount.toFixed(2),
    };
    const sign = md5Sign(buildEpayMessage(params), key());
    const form = new URLSearchParams({ ...params, sign, sign_type: 'MD5' });

    const res = await fetch(`${gateway()}/mapi.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(8_000),
    });
    const text = await res.text();
    let data: { code?: number; payurl?: string; trade_no?: string; msg?: string };
    try {
      data = JSON.parse(text); // 面板常以 text/html 回 JSON
    } catch {
      logger.error({ body: text.slice(0, 300), orderId: order.id }, 'epay mapi non-json');
      throw appError('INTERNAL', '支付网关响应异常');
    }
    if (data.code !== 1 || !data.payurl) {
      logger.error({ data, orderId: order.id }, 'epay mapi failed');
      throw appError('INTERNAL', `支付网关下单失败: ${data.msg ?? data.code ?? '未知错误'}`);
    }
    await cacheSet(`epay:payurl:${order.id}`, data.payurl, 60);
    return { provider: 'alipay', redirectUrl: data.payurl };
  },

  async verifyNotify(req: Request): Promise<NotifyResult> {
    if (!pid() || !key()) throw appError('INTERNAL', '支付网关未配置（EPAY_PID/EPAY_KEY）');
    const q = new URL(req.url).searchParams; // 已解码值，与 PHP $_GET 语义一致
    const params: Record<string, string> = {};
    q.forEach((v, k) => {
      params[k] = v;
    });
    const sign = params.sign ?? '';
    const expected = md5Sign(buildEpayMessage(params), key());
    if (!sign || sign !== expected) throw appError('FORBIDDEN', '验签失败');
    if (String(params.pid) !== pid()) throw appError('FORBIDDEN', '商户号不符');

    return {
      orderId: params.out_trade_no ?? '',
      transactionId: params.trade_no ?? '',
      paid: params.trade_status === 'TRADE_SUCCESS',
      paidAmount: params.money,
    };
  },

  async queryOrder(outTradeNo: string): Promise<QueryResult> {
    if (!pid() || !key()) throw appError('INTERNAL', '支付网关未配置（EPAY_PID/EPAY_KEY）');
    const u = new URL(`${gateway()}/api.php`);
    u.searchParams.set('act', 'order');
    u.searchParams.set('pid', pid());
    u.searchParams.set('key', key());
    u.searchParams.set('out_trade_no', outTradeNo);
    const res = await fetch(u, { signal: AbortSignal.timeout(8_000) });
    const data = (await res.json().catch(() => ({}))) as {
      code?: number;
      status?: number | string;
      trade_no?: string;
    };
    if (data.code !== 1) return { status: 'PENDING' }; // 查不到（未支付/不存在）一律按未付处理
    return {
      status: Number(data.status) === 1 ? 'PAID' : 'PENDING',
      tradeNo: data.trade_no,
    };
  },

  async refund(): Promise<{ refundId: string }> {
    // 码支付无退款 API（用户已确认禁用在线退款）：商户后台人工转账后处理
    throw appError('INTERNAL', '该通道不支持在线退款，请联系平台在商户后台人工退款');
  },

  ack() {
    return { body: 'success', contentType: 'text/plain' };
  },
};
