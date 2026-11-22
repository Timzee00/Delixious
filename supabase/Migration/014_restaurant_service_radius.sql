-- Add per-restaurant delivery radii as a second layer beneath state-zone caps.
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS service_radius_km numeric(7,2);
ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_service_radius_km_check;
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_service_radius_km_check
  CHECK (service_radius_km IS NULL OR service_radius_km BETWEEN 1 AND 300);
CREATE INDEX IF NOT EXISTS restaurants_state_service_radius_idx
  ON public.restaurants(state,service_area_verified,service_radius_km)
  WHERE service_area_verified = true;

CREATE OR REPLACE FUNCTION public.is_delivery_rider_eligible(p_order_id uuid,p_rider_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$
 SELECT EXISTS(SELECT 1 FROM public.orders o
 JOIN public.restaurants r ON r.id=o.restaurant_id JOIN public.profiles p ON p.id=p_rider_id
 JOIN public.delivery_zones z ON lower(z.state)=lower(o.destination_state)
 JOIN public.wallet_settings ws ON ws.id=1
 WHERE o.id=p_order_id AND o.payment_status='paid' AND o.status IN ('confirmed','preparing','out_for_delivery')
 AND p.role='delivery_agent' AND p.rider_approval_status='approved' AND p.rider_service_area_verified=true
 AND lower(p.rider_operating_state)=lower(o.destination_state)
 AND p.rider_base_lat IS NOT NULL AND p.rider_base_lng IS NOT NULL
 AND p.rider_service_radius_km IS NOT NULL AND p.rider_service_radius_km>0
 AND r.service_area_verified=true AND r.state IS NOT NULL AND r.lat IS NOT NULL AND r.lng IS NOT NULL
 AND r.service_radius_km IS NOT NULL AND r.service_radius_km>0
 AND o.destination_state IS NOT NULL AND o.delivery_lat IS NOT NULL AND o.delivery_lng IS NOT NULL
 AND (lower(r.state)=lower(o.destination_state) OR ws.allow_interstate_delivery=true)
 AND z.is_active=true AND z.base_fee_kobo IS NOT NULL AND z.per_km_fee_kobo IS NOT NULL AND z.max_distance_km IS NOT NULL
 AND public.delivery_distance_km(r.lat,r.lng,o.delivery_lat,o.delivery_lng)<=z.max_distance_km
 AND public.delivery_distance_km(r.lat,r.lng,o.delivery_lat,o.delivery_lng)<=r.service_radius_km
 AND public.delivery_distance_km(p.rider_base_lat,p.rider_base_lng,r.lat,r.lng)<=p.rider_service_radius_km
 AND public.delivery_distance_km(p.rider_base_lat,p.rider_base_lng,o.delivery_lat,o.delivery_lng)<=p.rider_service_radius_km)
$$;
REVOKE ALL ON FUNCTION public.is_delivery_rider_eligible(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.is_delivery_rider_eligible(uuid,uuid) TO service_role;
