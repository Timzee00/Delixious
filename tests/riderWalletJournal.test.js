import { describe, expect, it } from 'vitest';
import { buildRiderEarningJournal, buildRiderSettlementJournal } from '../src/utils/riderWalletJournal.js';

const wallet = 'a0b1c2d3-e4f5-4678-9abc-def012345678';

describe('rider wallet accounting', () => {
  it('moves an earned delivery amount from the unassigned payable control to the rider wallet', () => {
    const journal = buildRiderEarningJournal({ orderId: 'order-123', amountKobo: 100000, riderWalletAccountId: wallet });
    expect(journal.lines).toEqual([
      { accountCode: 'SYS:RIDER_PAYABLE', side: 'debit', amountKobo: 100000 },
      { accountCode: `WALLET:${wallet}:available`, side: 'credit', amountKobo: 100000 },
    ]);
  });

  it('debits rider available earnings only after a successful transfer', () => {
    const journal = buildRiderSettlementJournal({ reference: 'rider_payout_order-123', amountKobo: 100000, riderWalletAccountId: wallet });
    expect(journal.lines[0].side).toBe('debit');
    expect(journal.lines[1]).toEqual({ accountCode: 'SYS:BANK_SETTLEMENT', side: 'credit', amountKobo: 100000 });
  });

  it('restores rider available earnings after a transfer reversal', () => {
    const journal = buildRiderSettlementJournal({ reference: 'rider_payout_order-123', amountKobo: 100000, riderWalletAccountId: wallet, reversed: true });
    expect(journal.lines[0]).toEqual({ accountCode: 'SYS:BANK_SETTLEMENT', side: 'debit', amountKobo: 100000 });
    expect(journal.lines[1].side).toBe('credit');
  });

  it('rejects invalid rider payout amounts', () => {
    expect(() => buildRiderEarningJournal({ orderId: 'x', amountKobo: 0, riderWalletAccountId: wallet })).toThrow();
  });
});
