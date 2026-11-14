import { supabaseAdmin } from '../config/supabase.js';

export async function getRestaurantMenuManagement(req, res, next) {
  try {
    const { page = 1, limit = 30, q, category, availability = 'all' } = req.query;
    const from = (page - 1) * limit;
    let query = supabaseAdmin
      .from('menu_items')
      .select('id,restaurant_id,name,description,price,image_url,category,is_available,created_at', { count: 'exact' })
      .eq('restaurant_id', req.restaurant.id)
      .order('category', { ascending: true })
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + limit - 1);

    if (q) query = query.ilike('name', `%${q}%`);
    if (category) query = query.eq('category', category);
    if (availability === 'available') query = query.eq('is_available', true);
    if (availability === 'unavailable') query = query.eq('is_available', false);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ menu_items: data || [], total: count || 0, page, limit });
  } catch (err) {
    next(err);
  }
}
