import { supabaseAdmin } from '../config/supabase.js';

const MAX_LINES = 100;
const MAX_KEY_LENGTH = 200;

export function validateJournalPayload({ idempotencyKey, sourceType, lines, metadata = {} }) {
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > MAX_KEY_LENGTH) {
    throw new Error('A valid financial idempotency key is required.');
  }
  if (typeof sourceType !== 'string' || sourceType.length < 2 || sourceType.length > 80) {
    throw new Error('A valid financial source type is required.');
  }
  if (!Array.isArray(lines) || lines.length < 2 || lines.length > MAX_LINES) {
    throw new Error(`A financial journal must contain between 2 and ${MAX_LINES} lines.`);
  }

  let debits = 0n;
  let credits = 0n;
  const normalizedLines = lines.map((line) => {
    if (!line || typeof line.accountCode !== 'string' || !line.accountCode.trim() ||
        !['debit', 'credit'].includes(line.side) ||
        !Number.isSafeInteger(line.amountKobo) || line.amountKobo <= 0) {
      throw new Error('Every financial journal line needs an account, debit/credit side and positive integer kobo amount.');
    }
    if (line.side === 'debit') debits += BigInt(line.amountKobo);
    else credits += BigInt(line.amountKobo);
    return {
      account_code: line.accountCode.trim(),
      side: line.side,
      amount_kobo: line.amountKobo,
    };
  });

  if (debits !== credits) {
    throw new Error('Financial journal is not balanced.');
  }
  if (metadata === null || Array.isArray(metadata) || typeof metadata !== 'object') {
    throw new Error('Financial journal metadata must be an object.');
  }

  return normalizedLines;
}

export async function postFinancialJournal({
  idempotencyKey,
  sourceType,
  sourceId = null,
  description = '',
  lines,
  metadata = {},
}) {
  const normalizedLines = validateJournalPayload({ idempotencyKey, sourceType, lines, metadata });
  const { data, error } = await supabaseAdmin.rpc('post_financial_journal', {
    p_idempotency_key: idempotencyKey,
    p_source_type: sourceType,
    p_source_id: sourceId == null ? null : String(sourceId),
    p_description: String(description).slice(0, 500),
    p_lines: normalizedLines,
    p_metadata: metadata,
  });
  if (error) throw error;
  if (typeof data !== 'string' || !/^[0-9a-f-]{36}$/i.test(data)) {
    throw new Error('Financial ledger returned an invalid journal reference.');
  }
  return data;
}
