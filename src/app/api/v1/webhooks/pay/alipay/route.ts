import { orderService } from '@/server/services/order.service';
import { alipayProvider } from '@/server/payment/alipay';
import { logger } from '@/server/lib/logger';

// 支付宝回调（RSA2 验签 + 幂等）。失败不 ack，让支付宝重试。
export async function POST(req: Request) {
  try {
    const result = await alipayProvider.verifyNotify(req);
    if (result.paid && result.orderId) {
      await orderService.markPaid(
        result.orderId,
        result.transactionId,
        `alipay:${result.transactionId}`,
      );
    }
    const ack = alipayProvider.ack();
    return new Response(ack.body, { status: 200, headers: { 'Content-Type': ack.contentType } });
  } catch (e) {
    logger.error({ err: e }, 'alipay notify failed');
    return new Response('', { status: 500 });
  }
}
