import { z } from 'zod';

// V6：下单仅接受支付宝（走码支付网关）/mock；WECHAT 收款已下线（提现渠道的 WECHAT 与此无关）
export const createOrderSchema = z.object({
  payMethod: z.enum(['ALIPAY', 'MOCK']),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
