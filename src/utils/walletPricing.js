// Integer-kobo allocations. Customer delivery funds the rider in full; restaurant commission applies to food only.
export function calculateOrderAllocation(foodTotalKobo,deliveryFeeKobo,settings) {
  const restaurantBps=Number(settings?.restaurant_commission_bps);
  if(![foodTotalKobo,deliveryFeeKobo,restaurantBps].every(Number.isSafeInteger)||foodTotalKobo<=0||deliveryFeeKobo<0||deliveryFeeKobo>2000000||restaurantBps<0||restaurantBps>3000) throw new Error('Invalid food total or marketplace fee configuration.');
  const restaurantCommissionKobo=Math.round(foodTotalKobo*restaurantBps/10000);
  const restaurantShareKobo=foodTotalKobo-restaurantCommissionKobo;
  const customerTotalKobo=foodTotalKobo+deliveryFeeKobo;
  if(restaurantShareKobo<=0||!Number.isSafeInteger(customerTotalKobo)) throw new Error('The order total or restaurant allocation is invalid.');
  return {customerTotalKobo,customerDeliveryFeeKobo:deliveryFeeKobo,restaurantCommissionKobo,deliveryCostKobo:0,riderCommissionKobo:0,riderCommissionBps:0,riderPayoutKobo:deliveryFeeKobo,restaurantShareKobo,platformGrossCommissionKobo:restaurantCommissionKobo};
}
