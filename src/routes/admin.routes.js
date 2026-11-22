import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  approvalStatusSchema,
  suspendUserSchema,
  listRestaurantsAdminQuerySchema,
  listUsersAdminQuerySchema,
  listQuerySchema,
  broadcastSchema,
  deliveryZoneSchema,
  interstateDeliverySchema,
  financialJournalsQuerySchema,
  financialPayoutsQuerySchema,
  providerEventsQuerySchema,
} from '../schemas/admin.schema.js';
import {
  getStats,
  listRestaurantsAdmin,
  setRestaurantApproval,
  listRidersAdmin,
  setRiderApproval,
  listUsersAdmin,
  setUserSuspension,
  listOrdersAdmin,
  sendBroadcast,
  listDeliveryZones,
  saveDeliveryZone,
  setInterstateDelivery,
  getFinancialSummary,
  getFinancialHealth,
  listFinancialJournals,
  listFinancialPayouts,
  listProviderEvents,
} from '../controllers/admin.controller.js';

const router = Router();

// Every route below requires a logged-in admin.
router.use(requireAuth, requireRole('admin'));

router.get('/stats', getStats);
router.get('/finance/summary',getFinancialSummary);
router.get('/finance/health',getFinancialHealth);
router.get('/finance/journals',validate({query:financialJournalsQuerySchema}),listFinancialJournals);
router.get('/finance/payouts',validate({query:financialPayoutsQuerySchema}),listFinancialPayouts);
router.get('/finance/events',validate({query:providerEventsQuerySchema}),listProviderEvents);
router.get('/delivery-zones',listDeliveryZones);
router.put('/delivery-zones/:state',validate({body:deliveryZoneSchema}),saveDeliveryZone);
router.patch('/delivery-settings/interstate',validate({body:interstateDeliverySchema}),setInterstateDelivery);

router.get('/restaurants', validate({ query: listRestaurantsAdminQuerySchema }), listRestaurantsAdmin);
router.patch('/restaurants/:id/approval', validate({ body: approvalStatusSchema }), setRestaurantApproval);

router.get('/riders', validate({ query: listQuerySchema }), listRidersAdmin);
router.patch('/riders/:id/approval', validate({ body: approvalStatusSchema }), setRiderApproval);

router.get('/users', validate({ query: listUsersAdminQuerySchema }), listUsersAdmin);
router.patch('/users/:id/suspend', validate({ body: suspendUserSchema }), setUserSuspension);

router.get('/orders', validate({ query: listQuerySchema }), listOrdersAdmin);

router.post('/broadcast', validate({ body: broadcastSchema }), sendBroadcast);

export default router;
