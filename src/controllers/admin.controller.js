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
      .select('id,name,cuisine_type,address,state,lat,lng,service_radius_km,service_area_verified,approval_status,owner_id,created_at', { count: 'exact' })
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
    if (req.body.status === 'approved') {
      const { data: current, error: lookupError } = await supabaseAdmin.from('restaurants').select('state,lat,lng,service_radius_km').eq('id',req.params.id).single();
      if (lookupError) throw lookupError;
      if (!current?.state || current.lat == null || current.lng == null || !current.service_radius_km) return res.status(400).json({ error: 'Restaurant must submit its state, map coordinates and service radius before service-area verification.' });
    }
    const { data, error } = await supabaseAdmin
      .from('restaurants')
      .update({ approval_status: req.body.status, service_area_verified: req.body.status === 'approved' })
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
      .select('id,full_name,email,phone,rider_approval_status,rider_operating_state,rider_base_lat,rider_base_lng,rider_service_radius_km,rider_service_area_verified,rider_rating_avg,rider_rating_count,created_at', { count: 'exact' })
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
    if (req.body.status === 'approved') {
      const { data: current, error: lookupError } = await supabaseAdmin.from('profiles')
        .select('rider_operating_state,rider_base_lat,rider_base_lng,rider_service_radius_km')
        .eq('id',req.params.id).eq('role','delivery_agent').single();
      if (lookupError) throw lookupError;
      if (!current?.rider_operating_state || current.rider_base_lat == null || current.rider_base_lng == null || !current.rider_service_radius_km) {
        return res.status(400).json({ error: 'Rider must submit an operating state, base coordinates and service radius before verification.' });
      }
    }
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ rider_approval_status: req.body.status, rider_service_area_verified: req.body.status === 'approved' })
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

export async function listDeliveryZones(req,res,next){
  try {
    const [{data:zones,error:zoneError},{data:settings,error:settingsError}]=await Promise.all([
      supabaseAdmin.from('delivery_zones').select('*').order('state',{ascending:true}),
      supabaseAdmin.from('wallet_settings').select('allow_interstate_delivery').eq('id',1).single(),
    ]);
    if(zoneError)throw zoneError;
    if(settingsError)throw settingsError;
    res.json({zones:zones||[],allow_interstate_delivery:settings.allow_interstate_delivery===true});
  } catch(err){next(err);}
}
export async function saveDeliveryZone(req,res,next){
  try {
    const {normalizeNigerianState}=await import('../utils/nigeriaStates.js');
    const state=normalizeNigerianState(req.params.state);
    if(!state)return res.status(400).json({error:'Select a valid Nigerian state.'});
    const {data,error}=await supabaseAdmin.from('delivery_zones').upsert({
      state,base_fee_kobo:Math.round(Number(req.body.base_fee_naira)*100),
      per_km_fee_kobo:Math.round(Number(req.body.per_km_fee_naira)*100),
      included_distance_km:req.body.included_distance_km,max_distance_km:req.body.max_distance_km,
      is_active:req.body.is_active,updated_by:req.user.id,updated_at:new Date().toISOString(),
    },{onConflict:'state'}).select().single();
    if(error)throw error;
    res.json({message:'Delivery zone saved.',zone:data});
  } catch(err){next(err);}
}
export async function setInterstateDelivery(req,res,next){
  try {
    const {data,error}=await supabaseAdmin.from('wallet_settings')
      .update({allow_interstate_delivery:req.body.enabled,updated_by:req.user.id})
      .eq('id',1).select('allow_interstate_delivery').single();
    if(error)throw error;
    res.json({allow_interstate_delivery:data.allow_interstate_delivery});
  } catch(err){next(err);}
}


function encodeFinancialCursor(row) {
  return Buffer.from(JSON.stringify({ created_at: row.created_at, id: row.id })).toString('base64url');
}

function decodeFinancialCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed.created_at !== 'string' ||
        !Number.isFinite(Date.parse(parsed.created_at)) ||
        typeof parsed.id !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(parsed.id)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getFinancialSummary(req, res, next) {
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const { data, error } = await supabaseAdmin.rpc('get_financial_admin_summary', { p_days: days });
    if (error) throw error;
    res.set('Cache-Control', 'private, no-store');
    res.json({ summary: data });
  } catch (err) { next(err); }
}

export async function listFinancialJournals(req, res, next) {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 25));
    const cursor = decodeFinancialCursor(req.query.cursor);
    if (req.query.cursor && !cursor) return res.status(400).json({ error: 'Invalid financial history cursor.' });

    let query = supabaseAdmin.from('financial_journals')
      .select('id,source_type,source_id,description,currency,created_at,financial_journal_lines(id,side,amount_kobo,financial_accounts(account_code,account_name))')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    if (req.query.source_type) query = query.eq('source_type', req.query.source_type);
    if (cursor) {
      query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
    }

    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    const hasMore = rows.length > limit;
    const journals = rows.slice(0, limit).map(journal => ({
      ...journal,
      debit_total_kobo: (journal.financial_journal_lines || [])
        .filter(line => line.side === 'debit')
        .reduce((sum, line) => sum + Number(line.amount_kobo || 0), 0),
      line_count: journal.financial_journal_lines?.length || 0,
    }));
    const last = journals[journals.length - 1];
    res.set('Cache-Control', 'private, no-store');
    res.json({
      journals,
      has_more: hasMore,
      next_cursor: hasMore && last ? encodeFinancialCursor(last) : null,
      limit,
    });
  } catch (err) { next(err); }
}


export async function listFinancialPayouts(req, res, next) {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 25));
    const cursor = decodeFinancialCursor(req.query.cursor);
    if (req.query.cursor && !cursor) return res.status(400).json({ error: 'Invalid payout history cursor.' });
    let query = supabaseAdmin.from('financial_payouts')
      .select('id,payout_type,amount_kobo,status,account_last4,provider_reference,last_error_code,last_error_message,created_at,paid_at,profiles!financial_payouts_owner_user_id_fkey(full_name,phone)')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);
    if (req.query.status) query = query.eq('status', req.query.status);
    if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    const hasMore = rows.length > limit;
    const payouts = rows.slice(0, limit);
    const last = payouts[payouts.length - 1];
    res.set('Cache-Control', 'private, no-store');
    res.json({ payouts, has_more: hasMore, next_cursor: hasMore && last ? encodeFinancialCursor(last) : null, limit });
  } catch (err) { next(err); }
}

export async function listProviderEvents(req, res, next) {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 25));
    const cursor = decodeFinancialCursor(req.query.cursor);
    if (req.query.cursor && !cursor) return res.status(400).json({ error: 'Invalid provider event cursor.' });
    let query = supabaseAdmin.from('financial_provider_events')
      .select('id,event_type,provider_reference,state,attempt_count,last_error_code,last_error_message,received_at,processed_at')
      .order('received_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);
    if (req.query.state) query = query.eq('state', req.query.state);
    if (cursor) query = query.or(`received_at.lt.${cursor.created_at},and(received_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    const hasMore = rows.length > limit;
    const events = rows.slice(0, limit);
    const last = events[events.length - 1];
    const nextCursor = hasMore && last
      ? Buffer.from(JSON.stringify({ created_at: last.received_at, id: last.id })).toString('base64url')
      : null;
    res.set('Cache-Control', 'private, no-store');
    res.json({ events, has_more: hasMore, next_cursor: nextCursor, limit });
  } catch (err) { next(err); }
}


export async function getFinancialHealth(req,res,next) {
  try {
    const {data,error}=await supabaseAdmin.rpc('get_latest_financial_health');
    if(error)throw error;
    res.set('Cache-Control','private, no-store');
    res.json({health:data});
  } catch(err) { next(err); }
}
