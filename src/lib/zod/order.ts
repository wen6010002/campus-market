import { z } from 'zod';
import { PayMethod } from '../constants';

export const createOrderSchema = z.object({
  payMethod: z.nativeEnum(PayMethod),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
