import { supabaseAdmin } from '../config/supabase.js';

export async function getStats(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('admin_stats').select('*').single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ stats: data });
  } catch (err) {
    next(err);
  }
}

export async function listRestaurantsAdmin(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('restaurants')
      .select('id, name, cuisine_type, address, approval_status, owner_id, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to);

    if (status) query = query.eq('approval_status', status);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json({ restaurants: data, total: count, page, limit });
  } catch (err) {
    next(err);
  }
}

export async function setRestaurantApproval(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('restaurants')
      .update({ approval_status: req.body.status })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Restaurant status updated.', restaurant: data });
  } catch (err) {
    next(err);
  }
}

export async function listRidersAdmin(req, res, next) {
  try {
    const { page, limit } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, phone, rider_approval_status, rider_rating_avg, rider_rating_count, created_at', { count: 'exact' })
      .eq('role', 'delivery_agent')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ riders: data, total: count, page, limit });
  } catch (err) {
    next(err);
  }
}

export async function setRiderApproval(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ rider_approval_status: req.body.status })
      .eq('id', req.params.id)
      .eq('role', 'delivery_agent')
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Rider status updated.', rider: data });
  } catch (err) {
    next(err);
  }
}

export async function listUsersAdmin(req, res, next) {
  try {
    const { role, page, limit } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, phone, role, is_suspended, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to);

    if (role) query = query.eq('role', role);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json({ users: data, total: count, page, limit });
  } catch (err) {
    next(err);
  }
}

export async function setUserSuspension(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ is_suspended: req.body.suspended })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'User status updated.', user: data });
  } catch (err) {
    next(err);
  }
}

export async function listOrdersAdmin(req, res, next) {
  try {
    const { page, limit, status } = req.query;
    const from = (page - 1) * limit;
    let query = supabaseAdmin
      .from('orders')
      .select('id, user_id, restaurant_id, status, total_amount, platform_commission, created_at, restaurants(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + limit - 1);
    if (status) query = query.eq('status', status);
    const { data, error, count } = await query;

    if (error) return res.status(400).json({ error: error.message });
    res.json({ orders: data, total: count, page, limit });
  } catch (err) {
    next(err);
  }
}

export async function sendBroadcast(req, res, next) {
  try {
    const { title, message, role } = req.body;
    const PAGE_SIZE = 500;
    const INSERT_SIZE = 200;
    let offset = 0;
    let recipientTotal = 0;
    let sentCount = 0;

    // Never load every profile into application memory. Read stable ID pages
    // and insert notifications in small batches for large marketplaces.
    while (true) {
      let query = supabaseAdmin.from('profiles')
        .select('id', offset === 0 ? { count: 'exact' } : {})
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (role) query = query.eq('role', role);
      const { data: users, error: usersError, count } = await query;
      if (usersError) {
        if (sentCount > 0) {
          return res.status(502).json({
            code: 'BROADCAST_PARTIAL_FAILURE',
            error: 'Broadcast stopped after a partial delivery. Review the sent count before retrying.',
            sent_count: sentCount,
            recipient_total: recipientTotal,
          });
        }
        return res.status(400).json({ error: usersError.message, sent_count: 0 });
      }
      if (offset === 0) recipientTotal = count || 0;
      if (!users?.length) break;

      for (let index = 0; index < users.length; index += INSERT_SIZE) {
        const rows = users.slice(index, index + INSERT_SIZE).map(user => ({
          user_id: user.id,
          type: 'broadcast',
          title,
          body: message,
        }));
        const { error: insertError } = await supabaseAdmin.from('notifications').insert(rows);
        if (insertError) {
          return res.status(502).json({
            code: 'BROADCAST_PARTIAL_FAILURE',
            error: 'Broadcast stopped after a partial delivery. Review the sent count before retrying.',
            sent_count: sentCount,
            recipient_total: recipientTotal,
          });
        }
        sentCount += rows.length;
      }

      offset += users.length;
      if (users.length < PAGE_SIZE || offset >= recipientTotal) break;
    }

    res.status(201).json({ message: `Broadcast sent to ${sentCount.toLocaleString()} user(s).`, sent_count: sentCount, recipient_total: recipientTotal });
  } catch (err) {
    next(err);
  }
}
