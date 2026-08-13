import { orderService } from '@/server/services/order.service';
import { wechatProvider } from '@/server/payment/wechat';
import { logger } from '@/server/lib/logger';

// 微信支付回调（验签 + 幂等）。失败不 ack，让微信重试。
export async function POST(req: Request) {
  try {
    const result = await wechatProvider.verifyNotify(req);
    if (result.paid && result.orderId) {
      await orderService.markPaid(
        result.orderId,
        result.transactionId,
        `wechat:${result.transactionId}`,
      );
    }
    const ack = wechatProvider.ack();
    return new Response(ack.body, { status: 200, headers: { 'Content-Type': ack.contentType } });
  } catch (e) {
    logger.error({ err: e }, 'wechat notify failed');
    return new Response('', { status: 500 });
  }
}
