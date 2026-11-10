// All calculations use integer kobo. A restaurant pays the delivery cost;
// customers are charged the food price displayed at checkout.
export function calculateOrderAllocation(foodTotalKobo, settings) {
  const restaurantBps = Number(settings?.restaurant_commission_bps);
  const riderBps = Number(settings?.rider_commission_bps);
  const deliveryKobo = Number(settings?.restaurant_delivery_fee_kobo);
  if (![foodTotalKobo, restaurantBps, riderBps, deliveryKobo].every(Number.isSafeInteger)
      || foodTotalKobo <= 0 || restaurantBps < 0 || restaurantBps > 3000
      || riderBps < 0 || riderBps > 3000 || deliveryKobo < 0 || deliveryKobo > 2000000) {
    throw new Error('Invalid food total or marketplace fee configuration.');
  }
  const restaurantCommissionKobo = Math.round(foodTotalKobo * restaurantBps / 10000);
  const riderCommissionKobo = Math.round(deliveryKobo * riderBps / 10000);
  const restaurantShareKobo = foodTotalKobo - restaurantCommissionKobo - deliveryKobo;
  const riderPayoutKobo = deliveryKobo - riderCommissionKobo;
  if (restaurantShareKobo <= 0) {
    throw new Error('The order total does not cover restaurant commission and the restaurant-funded delivery cost.');
  }
  return {
    customerTotalKobo: foodTotalKobo,
    customerDeliveryFeeKobo: 0,
    restaurantCommissionKobo,
    deliveryCostKobo: deliveryKobo,
    riderCommissionKobo,
    riderPayoutKobo,
    restaurantShareKobo,
    platformGrossCommissionKobo: restaurantCommissionKobo + riderCommissionKobo,
  };
}
