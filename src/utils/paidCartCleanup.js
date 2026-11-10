/**
 * Only delete cart lines that still exactly match what the customer paid for.
 * Never clear an entire cart at payment initialization or discard items added
 * after the checkout was started.
 */
export function purchasedCartLineIds(cartItems, purchasedItems) {
  const purchased = new Map();
  for (const item of purchasedItems || []) {
    if (!item.menu_item_id) continue;
    purchased.set(item.menu_item_id, Number(item.quantity));
  }
  return (cartItems || [])
    .filter((item) => purchased.has(item.menu_item_id)
      && Number(item.quantity) === purchased.get(item.menu_item_id))
    .map((item) => item.id);
}

export async function removePurchasedCartLines(db, order) {
  const { data: cart, error: cartError } = await db
    .from('carts')
    .select('id')
    .eq('user_id', order.user_id)
    .eq('restaurant_id', order.restaurant_id)
    .maybeSingle();
  if (cartError) throw cartError;
  if (!cart) return 0;

  const [cartResult, purchasedResult] = await Promise.all([
    db.from('cart_items').select('id, menu_item_id, quantity').eq('cart_id', cart.id),
    db.from('order_items').select('menu_item_id, quantity').eq('order_id', order.id),
  ]);
  if (cartResult.error) throw cartResult.error;
  if (purchasedResult.error) throw purchasedResult.error;

  const matches = purchasedCartLineIds(cartResult.data, purchasedResult.data);
  // Guard the quantity again on DELETE: the customer may have edited their
  // cart between the SELECT above and this write.
  for (const id of matches) {
    const item = cartResult.data.find((row) => row.id === id);
    const { error } = await db.from('cart_items')
      .delete()
      .eq('id', id)
      .eq('cart_id', cart.id)
      .eq('quantity', item.quantity);
    if (error) throw error;
  }
  return matches.length;
}
