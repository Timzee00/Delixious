import { z } from 'zod';

export const assignAgentSchema = z.object({
  delivery_agent_id: z.string().uuid('delivery_agent_id must be a valid id.'),
});

export const updateLocationSchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
});

export const updateDeliveryStatusSchema = z.object({
  status: z.enum(['assigned', 'picked_up', 'en_route', 'delivered']),
});

export const deliveryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const availableDeliveriesQuerySchema = deliveryListQuerySchema;

export const searchAgentsQuerySchema = z.object({
  phone: z.string().trim().min(3, "Provide at least 3 digits of the agent's phone number."),
});
