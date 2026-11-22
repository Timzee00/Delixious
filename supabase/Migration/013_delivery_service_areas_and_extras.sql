-- Customer-funded delivery zones, verified dispatch areas and item-level food extras.
-- No fee rates are seeded; an administrator must configure an active zone for each state.
ALTER TABLE public.wallet_settings ADD COLUMN IF NOT EXISTS allow_interstate_delivery boolean NOT NULL DEFAULT false;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS extras jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS selected_extras jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS extras_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS state text, ADD COLUMN IF NOT EXISTS service_area_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rider_operating_state text, ADD COLUMN IF NOT EXISTS rider_base_lat double precision, ADD COLUMN IF NOT EXISTS rider_base_lng double precision, ADD COLUMN IF NOT EXISTS rider_service_radius_km numeric(7,2), ADD COLUMN IF NOT EXISTS rider_service_area_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS destination_state text, ADD COLUMN IF NOT EXISTS delivery_zone_state text, ADD COLUMN IF NOT EXISTS delivery_distance_km numeric(9,3), ADD COLUMN IF NOT EXISTS customer_delivery_fee_kobo bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.delivery_zones (
 state text PRIMARY KEY, base_fee_kobo integer, per_km_fee_kobo integer,
 included_distance_km numeric(7,2) NOT NULL DEFAULT 0, max_distance_km numeric(7,2),
 is_active boolean NOT NULL DEFAULT false, updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT delivery_zones_rates_nonnegative CHECK ((base_fee_kobo IS NULL OR base_fee_kobo>=0) AND (per_km_fee_kobo IS NULL OR per_km_fee_kobo>=0) AND included_distance_km>=0 AND (max_distance_km IS NULL OR max_distance_km>0))
);
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_zones FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.delivery_zones TO service_role;
CREATE INDEX IF NOT EXISTS delivery_tracking_pending_order_idx ON public.delivery_tracking(status,updated_at,order_id) WHERE delivery_agent_id IS NULL AND status='pending';
CREATE INDEX IF NOT EXISTS orders_destination_state_idx ON public.orders(destination_state,payment_status,status);
CREATE INDEX IF NOT EXISTS profiles_rider_service_state_idx ON public.profiles(rider_operating_state,rider_approval_status) WHERE role='delivery_agent' AND rider_service_area_verified=true;

CREATE OR REPLACE FUNCTION public.delivery_distance_km(p_lat1 double precision,p_lng1 double precision,p_lat2 double precision,p_lng2 double precision)
RETURNS numeric LANGUAGE sql IMMUTABLE STRICT SET search_path=''
AS $$
 SELECT (6371*2*asin(least(1::double precision,sqrt(power(sin(radians(p_lat2-p_lat1)/2),2)+cos(radians(p_lat1))*cos(radians(p_lat2))*power(sin(radians(p_lng2-p_lng1)/2),2)))))::numeric
$$;
REVOKE ALL ON FUNCTION public.delivery_distance_km(double precision,double precision,double precision,double precision) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_distance_km(double precision,double precision,double precision,double precision) TO service_role;

CREATE OR REPLACE FUNCTION public.is_delivery_rider_eligible(p_order_id uuid,p_rider_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$
 SELECT EXISTS(SELECT 1 FROM public.orders o
 JOIN public.restaurants r ON r.id=o.restaurant_id JOIN public.profiles p ON p.id=p_rider_id
 JOIN public.delivery_zones z ON lower(z.state)=lower(o.destination_state)
 JOIN public.wallet_settings ws ON ws.id=1
 WHERE o.id=p_order_id AND o.payment_status='paid' AND o.status IN ('confirmed','preparing','out_for_delivery')
 AND p.role='delivery_agent' AND p.rider_approval_status='approved' AND p.rider_service_area_verified=true
 AND lower(p.rider_operating_state)=lower(r.state) AND p.rider_base_lat IS NOT NULL AND p.rider_base_lng IS NOT NULL
 AND p.rider_service_radius_km IS NOT NULL AND p.rider_service_radius_km>0
 AND r.service_area_verified=true AND r.state IS NOT NULL AND r.lat IS NOT NULL AND r.lng IS NOT NULL
 AND o.destination_state IS NOT NULL AND o.delivery_lat IS NOT NULL AND o.delivery_lng IS NOT NULL
 AND (lower(r.state)=lower(o.destination_state) OR ws.allow_interstate_delivery=true)
 AND z.is_active=true AND z.base_fee_kobo IS NOT NULL AND z.per_km_fee_kobo IS NOT NULL AND z.max_distance_km IS NOT NULL
 AND public.delivery_distance_km(r.lat,r.lng,o.delivery_lat,o.delivery_lng)<=z.max_distance_km
 AND public.delivery_distance_km(p.rider_base_lat,p.rider_base_lng,r.lat,r.lng)<=p.rider_service_radius_km
 AND public.delivery_distance_km(p.rider_base_lat,p.rider_base_lng,o.delivery_lat,o.delivery_lng)<=p.rider_service_radius_km)
$$;
REVOKE ALL ON FUNCTION public.is_delivery_rider_eligible(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.is_delivery_rider_eligible(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.list_available_deliveries(p_rider_id uuid,p_page integer DEFAULT 1,p_limit integer DEFAULT 20)
RETURNS TABLE(order_id uuid,status text,updated_at timestamptz,orders jsonb,total_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$
 WITH eligible AS(SELECT dt.order_id,dt.status,dt.updated_at,o.id AS id,o.delivery_address,o.delivery_lat,o.delivery_lng,o.destination_state,o.total_amount,o.rider_payout_amount,o.status AS order_status,o.payment_status,r.name AS restaurant_name,r.address AS restaurant_address,count(*) OVER() AS total_count
 FROM public.delivery_tracking dt JOIN public.orders o ON o.id=dt.order_id JOIN public.restaurants r ON r.id=o.restaurant_id
 WHERE dt.status='pending' AND dt.delivery_agent_id IS NULL AND public.is_delivery_rider_eligible(o.id,p_rider_id))
 SELECT e.order_id,e.status,e.updated_at,jsonb_build_object('id',e.id,'delivery_address',e.delivery_address,'delivery_lat',e.delivery_lat,'delivery_lng',e.delivery_lng,'destination_state',e.destination_state,'total_amount',e.total_amount,'rider_payout_amount',e.rider_payout_amount,'status',e.order_status,'payment_status',e.payment_status,'restaurants',jsonb_build_object('name',e.restaurant_name,'address',e.restaurant_address)),e.total_count
 FROM eligible e ORDER BY e.updated_at,e.order_id LIMIT greatest(1,least(coalesce(p_limit,20),50)) OFFSET (greatest(1,coalesce(p_page,1))-1)*greatest(1,least(coalesce(p_limit,20),50))
$$;
REVOKE ALL ON FUNCTION public.list_available_deliveries(uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.list_available_deliveries(uuid,integer,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_delivery(p_order_id uuid,p_rider_id uuid)
RETURNS SETOF public.delivery_tracking LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''
AS $$
 UPDATE public.delivery_tracking dt SET delivery_agent_id=p_rider_id,status='assigned',claimed_at=now(),updated_at=now()
 WHERE dt.order_id=p_order_id AND dt.status='pending' AND dt.delivery_agent_id IS NULL AND public.is_delivery_rider_eligible(p_order_id,p_rider_id) RETURNING dt.*
$$;
REVOKE ALL ON FUNCTION public.claim_delivery(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_delivery(uuid,uuid) TO service_role;
