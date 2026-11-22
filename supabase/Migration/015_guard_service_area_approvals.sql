-- Protect the new dispatch-approval flags from direct authenticated clients.
-- Owners may submit location data, but only service-role admin operations may verify it.
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.id THEN
    IF NEW.role IS DISTINCT FROM OLD.role
      OR NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
      OR NEW.rider_approval_status IS DISTINCT FROM OLD.rider_approval_status
      OR NEW.rider_service_area_verified IS DISTINCT FROM OLD.rider_service_area_verified
      OR NEW.rider_paystack_subaccount_code IS DISTINCT FROM OLD.rider_paystack_subaccount_code
      OR NEW.rider_bank_name IS DISTINCT FROM OLD.rider_bank_name
      OR NEW.rider_bank_account_number IS DISTINCT FROM OLD.rider_bank_account_number
      OR NEW.rider_bank_account_name IS DISTINCT FROM OLD.rider_bank_account_name
      OR NEW.rider_transfer_recipient_code IS DISTINCT FROM OLD.rider_transfer_recipient_code
    THEN
      RAISE EXCEPTION 'Protected profile and dispatch-approval fields cannot be changed by the account owner.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.rider_operating_state IS DISTINCT FROM OLD.rider_operating_state
      OR NEW.rider_base_lat IS DISTINCT FROM OLD.rider_base_lat
      OR NEW.rider_base_lng IS DISTINCT FROM OLD.rider_base_lng
      OR NEW.rider_service_radius_km IS DISTINCT FROM OLD.rider_service_radius_km
    THEN
      NEW.rider_service_area_verified := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_restaurant_service_area()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.owner_id THEN
    IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
      OR NEW.service_area_verified IS DISTINCT FROM OLD.service_area_verified
    THEN
      RAISE EXCEPTION 'Restaurant approval and service-area verification are admin-controlled.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.state IS DISTINCT FROM OLD.state
      OR NEW.lat IS DISTINCT FROM OLD.lat
      OR NEW.lng IS DISTINCT FROM OLD.lng
      OR NEW.service_radius_km IS DISTINCT FROM OLD.service_radius_km
    THEN
      NEW.service_area_verified := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_restaurant_service_area ON public.restaurants;
CREATE TRIGGER trg_guard_restaurant_service_area
BEFORE UPDATE ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.guard_restaurant_service_area();

-- This function is maintained for auth/profile synchronization and must not be
-- directly callable as an unauthenticated or ordinary-user SECURITY DEFINER RPC.
REVOKE ALL ON FUNCTION public.sync_profile_email_from_auth() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
