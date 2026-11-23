import { z } from 'zod';

export const approvalStatusSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

export const suspendUserSchema = z.object({
  suspended: z.boolean(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  status: z.enum(['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled']).optional(),
  q: z.string().trim().max(100).optional(),
});

export const listRestaurantsAdminQuerySchema = listQuerySchema.extend({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

export const listUsersAdminQuerySchema = listQuerySchema.extend({
  role: z.enum(['customer', 'restaurant_owner', 'delivery_agent', 'admin']).optional(),
});

export const broadcastSchema = z.object({
  title: z.string().trim().min(1, 'title is required.'),
  message: z.string().trim().min(1, 'message is required.'),
  role: z.enum(['customer', 'restaurant_owner', 'delivery_agent']).optional(),
});

export const deliveryZoneSchema = z.object({
  base_fee_naira:z.coerce.number().finite().min(0).max(20000),
  per_km_fee_naira:z.coerce.number().finite().min(0).max(5000),
  included_distance_km:z.coerce.number().finite().min(0).max(100),
  max_distance_km:z.coerce.number().finite().min(1).max(300),
  is_active:z.boolean(),
});
export const interstateDeliverySchema = z.object({enabled:z.boolean()});

export const financialJournalsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional().default(25),
  cursor: z.string().max(300).optional(),
  source_type: z.string().trim().min(2).max(80).optional(),
});

export const financialPayoutsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional().default(25),
  cursor: z.string().max(300).optional(),
  status: z.enum(['queued','on_hold','approved','processing','paid','failed','reversed','cancelled']).optional(),
});

export const providerEventsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional().default(25),
  cursor: z.string().max(300).optional(),
  state: z.enum(['received','processing','processed','failed','ignored']).optional(),
});
