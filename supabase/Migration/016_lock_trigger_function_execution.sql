-- Trigger functions are invoked by PostgreSQL triggers, not exposed RPC calls.
-- Keep them non-callable by API roles while retaining trigger execution.
REVOKE ALL ON FUNCTION public.guard_restaurant_service_area() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_self_privilege_changes() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
