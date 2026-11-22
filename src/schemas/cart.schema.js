import { z } from 'zod';

export const addCartItemSchema = z.object({
  menu_item_id: z.string().uuid('menu_item_id must be a valid id.'),
  quantity: z.coerce.number().int().min(1).optional().default(1),
  special_instructions: z.string().trim().max(500).optional(),
  replace: z.boolean().optional().default(false),
  selected_extras: z.array(z.object({extra_id:z.string().uuid(),quantity:z.coerce.number().int().min(1).max(20)})).max(20).optional().default([]),
});

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(1).optional(),
  special_instructions: z.string().trim().max(500).optional(),
});
