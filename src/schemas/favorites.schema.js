import { z } from 'zod';

export const listFavoriteRestaurantsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(12),
  q: z.string().trim().max(100).optional(),
  restaurant_ids: z.string().trim().max(2000).optional().refine(
    value => !value || (value.split(',').length <= 50 && value.split(',').every(id => /^[0-9a-f-]{36}$/i.test(id.trim()))),
    'restaurant_ids must contain up to 50 valid restaurant IDs.'
  ),
});
