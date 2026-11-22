import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/supabase.js', () => ({
  supabaseAdmin: { rpc: vi.fn() },
}));

import { supabaseAdmin } from '../src/config/supabase.js';
import { postFinancialJournal, validateJournalPayload } from '../src/services/financialLedger.js';

const valid = {
  idempotencyKey: 'order-payment-123',
  sourceType: 'order_payment',
  sourceId: 'order-123',
  description: 'Verified customer payment',
  lines: [
    { accountCode: 'SYS:PAYSTACK_CLEARING', side: 'debit', amountKobo: 1100000 },
    { accountCode: 'SYS:RESTAURANT_PAYABLE', side: 'credit', amountKobo: 900000 },
    { accountCode: 'SYS:PLATFORM_COMMISSION_REVENUE', side: 'credit', amountKobo: 100000 },
    { accountCode: 'SYS:RIDER_PAYABLE', side: 'credit', amountKobo: 100000 },
  ],
  metadata: { currency: 'NGN' },
};

describe('financial ledger service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts balanced journals and normalizes database field names', () => {
    const lines = validateJournalPayload(valid);
    expect(lines[0]).toEqual({
      account_code: 'SYS:PAYSTACK_CLEARING',
      side: 'debit',
      amount_kobo: 1100000,
    });
  });

  it('rejects unbalanced journals before making a database call', async () => {
    const payload = { ...valid, lines: valid.lines.map((line, index) => index === 3 ? { ...line, amountKobo: 99999 } : line) };
    await expect(postFinancialJournal(payload)).rejects.toThrow(/not balanced/i);
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('rejects floating point and unsafe integer amounts', () => {
    expect(() => validateJournalPayload({ ...valid, lines: [{ ...valid.lines[0], amountKobo: 1.5 }, valid.lines[1]] })).toThrow(/integer kobo/i);
    expect(() => validateJournalPayload({ ...valid, lines: [{ ...valid.lines[0], amountKobo: Number.MAX_SAFE_INTEGER + 1 }, valid.lines[1]] })).toThrow(/integer kobo/i);
  });

  it('rejects malformed lines and invalid idempotency keys', () => {
    expect(() => validateJournalPayload({ ...valid, idempotencyKey: 'short' })).toThrow(/idempotency/i);
    expect(() => validateJournalPayload({ ...valid, lines: [{ ...valid.lines[0], side: 'credit' }, valid.lines[1]] })).toThrow(/not balanced/i);
    expect(() => validateJournalPayload({ ...valid, lines: [{ ...valid.lines[0], amountKobo: 0 }, valid.lines[1]] })).toThrow(/positive integer/i);
  });

  it('posts only validated journals through the database RPC', async () => {
    supabaseAdmin.rpc.mockResolvedValue({ data: 'a0b1c2d3-e4f5-4678-9abc-def012345678', error: null });
    await expect(postFinancialJournal(valid)).resolves.toBe('a0b1c2d3-e4f5-4678-9abc-def012345678');
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('post_financial_journal', expect.objectContaining({
      p_idempotency_key: valid.idempotencyKey,
      p_source_type: valid.sourceType,
    }));
  });

  it('propagates database posting errors and rejects invalid returned IDs', async () => {
    supabaseAdmin.rpc.mockResolvedValueOnce({ data: null, error: new Error('database unavailable') });
    await expect(postFinancialJournal(valid)).rejects.toThrow('database unavailable');
    supabaseAdmin.rpc.mockResolvedValueOnce({ data: 'not-a-uuid', error: null });
    await expect(postFinancialJournal(valid)).rejects.toThrow(/invalid journal reference/i);
  });
});
