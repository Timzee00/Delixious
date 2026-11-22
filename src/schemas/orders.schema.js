import { z } from 'zod';

export const checkoutSchema = z.object({
  delivery_address: z.string().trim().min(5, 'delivery_address is required.').max(500),
  delivery_state: z.string().trim().min(2).max(40),
  delivery_lat: z.coerce.number().finite().min(-90).max(90),
  delivery_lng: z.coerce.number().finite().min(-180).max(180),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled']),
});

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  paid_only: z.enum(['true', 'false']).optional(),
  statuses: z.string().trim().max(100).optional().refine(
    value => !value || value.split(',').every(status => ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'].includes(status)),
    'One or more order statuses are invalid.'
  ),
});
