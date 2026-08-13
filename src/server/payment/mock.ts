import type { PayProvider, PayParams, NotifyResult } from './index';

/** mock 支付：下单即成功（本地/E2E）。 */
export const mockProvider: PayProvider = {
  async createOrder(): Promise<PayParams> {
    return { provider: 'mock', paid: true };
  },
  async verifyNotify(): Promise<NotifyResult> {
    throw new Error('mock 模式无回调');
  },
  async queryOrder(): Promise<'PAID' | 'PENDING' | 'CLOSED' | 'FAILED'> {
    return 'PAID';
  },
  ack() {
    return { body: 'ok', contentType: 'text/plain' };
  },
};
