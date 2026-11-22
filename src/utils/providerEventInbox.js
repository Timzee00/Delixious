import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';

function safeEventPayload(event, data) {
  const source = data && typeof data === 'object' ? data : {};
  const safe = {};
  for (const key of ['id','reference','status','amount','currency','fees','transfer_code','reason','created_at','updated_at','paid_at','domain']) {
    if (source[key] !== undefined) safe[key] = source[key];
  }
  if (source.split && typeof source.split === 'object') {
    const split = source.split;
    safe.split = {
      id: split.id,
      split_code: split.split_code,
      formula: split.formula ? {
        type: split.formula.type,
        bearer_type: split.formula.bearer_type,
        subaccounts: (split.formula.subaccounts || []).map(item => ({
          subaccount_code: item.subaccount_code,
          share: item.share,
        })),
      } : undefined,
      shares: split.shares ? {
        paystack: split.shares.paystack,
        integration: split.shares.integration,
        subaccounts: (split.shares.subaccounts || []).map(item => ({
          subaccount_code: item.subaccount_code,
          amount: item.amount,
        })),
      } : undefined,
    };
  }
  return { event, data: safe };
}

function eventIdentity(event, data, rawBody) {
  const source = data && typeof data === 'object' ? data : {};
  const identity = [
    event || 'unknown',
    source.reference || '',
    source.id || '',
    source.status || '',
    source.amount ?? '',
    source.transfer_code || '',
    source.updated_at || source.created_at || '',
  ].join('|');
  return crypto.createHash('sha256').update(identity || rawBody || '').digest('hex');
}

export async function beginProviderEvent(event, data, rawBody) {
  if (typeof event !== 'string' || !event.trim()) throw new Error('Provider event type is missing.');
  const eventKey = eventIdentity(event, data, rawBody);
  const safePayload = safeEventPayload(event, data);
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(safePayload)).digest('hex');
  const source = data && typeof data === 'object' ? data : {};

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('financial_provider_events')
    .insert({
      provider: 'paystack',
      event_key: eventKey,
      event_type: event,
      provider_reference: source.reference || source.transfer_code || null,
      payload_hash: payloadHash,
      payload: safePayload,
      state: 'received',
    })
    .select('id,state,attempt_count,processing_started_at')
    .maybeSingle();

  let record = inserted;
  if (insertError) {
    if (insertError.code !== '23505') throw insertError;
    const { data: existing, error } = await supabaseAdmin
      .from('financial_provider_events')
      .select('id,state,attempt_count,processing_started_at')
      .eq('provider', 'paystack')
      .eq('event_key', eventKey)
      .maybeSingle();
    if (error) throw error;
    record = existing;
  }
  if (!record) throw new Error('Provider event could not be recorded.');

  if (record.state === 'processed' || record.state === 'ignored') {
    return { id: record.id, duplicate: true, claimed: false };
  }

  const staleBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const staleProcessing = record.state === 'processing' &&
    record.processing_started_at && Date.parse(record.processing_started_at) < Date.parse(staleBefore);
  if (record.state === 'processing' && !staleProcessing) {
    return { id: record.id, duplicate: true, claimed: false, busy: true };
  }

  let claim = supabaseAdmin.from('financial_provider_events')
    .update({
      state: 'processing',
      attempt_count: Number(record.attempt_count || 0) + 1,
      processing_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_error_code: null,
      last_error_message: null,
    })
    .eq('id', record.id)
    .eq('attempt_count', Number(record.attempt_count || 0));
  claim = staleProcessing
    ? claim.eq('state', 'processing').lt('processing_started_at', staleBefore)
    : claim.in('state', ['received', 'failed']);
  const { data: claimed, error: claimError } = await claim.select('id').maybeSingle();
  if (claimError) throw claimError;
  return { id: record.id, duplicate: !claimed, claimed: Boolean(claimed), busy: !claimed };
}

export async function finishProviderEvent(id, state = 'processed', error = null) {
  if (!['processed','ignored','failed'].includes(state)) throw new Error('Invalid provider event terminal state.');
  const { error: updateError } = await supabaseAdmin.from('financial_provider_events')
    .update({
      state,
      processed_at: state === 'processed' || state === 'ignored' ? new Date().toISOString() : null,
      last_error_code: error?.code ? String(error.code).slice(0, 100) : null,
      last_error_message: error?.message ? String(error.message).slice(0, 500) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('state', 'processing');
  if (updateError) throw updateError;
}
