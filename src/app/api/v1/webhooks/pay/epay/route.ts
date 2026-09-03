import { orderService } from '@/server/services/order.service';
import { epayProvider } from '@/server/payment/epay';
import { logger } from '@/server/lib/logger';

// 码支付异步通知（GET + MD5 验签，应答纯文本 success）。失败不 ack（500），平台自动重试。
// 裸 handler（不套 withErrorHandler——它返回 JSON，这里要纯文本协议应答）。
export async function GET(req: Request) {
  try {
    const result = await epayProvider.verifyNotify(req);
    if (result.paid && result.orderId) {
      await orderService.markPaid(
        result.orderId,
        result.transactionId,
        `epay:${result.transactionId}`,
        { paidAmount: result.paidAmount },
      );
    }
    const ack = epayProvider.ack();
    return new Response(ack.body, { status: 200, headers: { 'Content-Type': ack.contentType } });
  } catch (e) {
    logger.error({ err: e, url: req.url.slice(0, 500) }, 'epay notify failed');
    return new Response('', { status: 500 });
  }
}
