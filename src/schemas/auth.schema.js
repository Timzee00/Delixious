import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  full_name: z.string().trim().min(1, 'full_name is required.'),
  phone: z.string().trim().optional(),
  role: z.enum(['customer', 'restaurant_owner', 'delivery_agent']).optional().default('customer'),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export const refreshSchema = z.object({}).optional();

export const updateProfileSchema = z.object({
  full_name: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional(),
  avatar_url: z.string().url().optional().or(z.literal('')),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(254),
});

export const recoverySessionSchema = z.union([
  z.object({ token_hash: z.string().min(20).max(2048) }),
  z.object({ access_token: z.string().min(20).max(4096), refresh_token: z.string().min(20).max(4096) }),
]);

export const passwordUpdateSchema = z.object({
  password: z.string().min(8).max(128),
});
