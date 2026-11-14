import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { listFavoriteRestaurantsQuerySchema } from '../schemas/favorites.schema.js';
import { requireAuth } from '../middleware/auth.js';
import { listFavoriteRestaurants, addFavoriteRestaurant, removeFavoriteRestaurant } from '../controllers/favorites.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/restaurants', validate({ query: listFavoriteRestaurantsQuerySchema }), listFavoriteRestaurants);
router.post('/restaurants/:restaurantId', addFavoriteRestaurant);
router.delete('/restaurants/:restaurantId', removeFavoriteRestaurant);

export default router;
