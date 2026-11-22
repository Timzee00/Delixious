import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  walletOverview, walletActivity, walletWithdrawals,
  requestWalletFunding, requestWalletWithdrawal, adminWalletSettings,
} from '../controllers/wallet.controller.js';

const router = Router();
router.use(requireAuth);

const activityQuery = z.object({
  wallet_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().max(300).optional(),
});

const settingsSchema = z.object({
  restaurant_commission_bps: z.number().int().min(0).max(3000),
}).strict();

router.get('/', walletOverview);
router.get('/activity', validate({ query: activityQuery }), walletActivity);
router.get('/withdrawals', walletWithdrawals);
router.post('/funding', requestWalletFunding);
router.post('/withdrawals', requestWalletWithdrawal);
router.patch('/settings', requireRole('admin'), validate({ body: settingsSchema }), adminWalletSettings);

export default router;
