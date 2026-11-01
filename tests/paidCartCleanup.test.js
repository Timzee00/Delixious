import { describe, it, expect } from 'vitest';
import { purchasedCartLineIds } from '../src/utils/paidCartCleanup.js';

const items = [
  { id: 'line-one', menu_item_id: 'food-a', quantity: 2 },
  { id: 'line-two', menu_item_id: 'food-b', quantity: 1 },
  { id: 'line-three', menu_item_id: 'food-c', quantity: 4 },
];

describe('safe post-payment cart cleanup', () => {
  it('deletes only items whose quantity is unchanged since checkout', () => {
    expect(purchasedCartLineIds(items, [
      { menu_item_id: 'food-a', quantity: 2 },
      { menu_item_id: 'food-b', quantity: 3 },
    ])).toEqual(['line-one']);
  });

  it('never removes newly added cart lines', () => {
    expect(purchasedCartLineIds(items, [
      { menu_item_id: 'food-x', quantity: 1 },
    ])).toEqual([]);
  });

  it('preserves a line when its quantity has changed after checkout', () => {
    expect(purchasedCartLineIds(items, [
      { menu_item_id: 'food-c', quantity: 2 },
    ])).toEqual([]);
  });

  it('handles an empty purchase snapshot', () => {
    expect(purchasedCartLineIds(items, [])).toEqual([]);
  });
});
