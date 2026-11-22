import { normalizeNigerianState } from './nigeriaStates.js';
export function haversineKm(lat1,lng1,lat2,lng2) {
  const values=[lat1,lng1,lat2,lng2].map(Number);
  if(!values.every(Number.isFinite)||values[0]<-90||values[0]>90||values[2]<-90||values[2]>90||values[1]<-180||values[1]>180||values[3]<-180||values[3]>180) throw new Error('A valid delivery location is required.');
  const [aLat,aLng,bLat,bLng]=values.map(v=>v*Math.PI/180),dLat=bLat-aLat,dLng=bLng-aLng;
  const h=Math.sin(dLat/2)**2+Math.cos(aLat)*Math.cos(bLat)*Math.sin(dLng/2)**2;
  return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function calculateDeliveryFeeKobo(zone,distanceKm) {
  const base=Number(zone?.base_fee_kobo),perKm=Number(zone?.per_km_fee_kobo),included=Number(zone?.included_distance_km||0),max=Number(zone?.max_distance_km);
  if(!zone?.is_active||![base,perKm,included,max,distanceKm].every(Number.isFinite)||base<0||perKm<0||included<0||max<=0||distanceKm<0||distanceKm>max) throw new Error('Delivery is outside the active service zone or its configured distance limit.');
  const fee=Math.ceil(base+Math.max(0,distanceKm-included)*perKm);
  if(!Number.isSafeInteger(fee)||fee<0||fee>2000000) throw new Error('The configured delivery fee is invalid.');
  return fee;
}
export function assertRestaurantDeliveryArea({restaurant,destinationState,deliveryLat,deliveryLng,zone,allowInterstate}) {
  const destination=normalizeNigerianState(destinationState),origin=normalizeNigerianState(restaurant?.state);
  if(!destination||!origin) throw new Error('Select a valid Nigerian state and ensure the restaurant has submitted its operating state.');
  if(!restaurant.service_area_verified||restaurant.lat==null||restaurant.lng==null) throw new Error('This restaurant has not completed service-area verification.');
  if(destination!==origin&&!allowInterstate) throw new Error('This restaurant does not currently deliver outside its state.');
  const distanceKm=haversineKm(restaurant.lat,restaurant.lng,deliveryLat,deliveryLng);
  return {destinationState:destination,distanceKm,deliveryFeeKobo:calculateDeliveryFeeKobo(zone,distanceKm)};
}
