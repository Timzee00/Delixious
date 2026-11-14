import { z } from 'zod';

export const createMenuItemSchema = z.object({
  name: z.string().trim().min(1, 'name is required.'),
  description: z.string().trim().optional(),
  price: z.coerce.number().min(0, 'price cannot be negative.'),
  image_url: z.string().url().optional().or(z.literal('')),
  category: z.string().trim().optional(),
  is_available: z.boolean().optional().default(true),
});

export const updateMenuItemSchema = createMenuItemSchema.partial();


export const listRestaurantMenuQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(30),
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(50).optional(),
});

export const listMenuManagementQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(30),
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(50).optional(),
  availability: z.enum(['all', 'available', 'unavailable']).optional().default('all'),
});
