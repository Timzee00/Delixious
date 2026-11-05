-- Delixious read-path index candidates for marketplace growth.
-- Apply to staging first. Review EXPLAIN (ANALYZE, BUFFERS), unused indexes,
-- table sizes, write latency and index costs before production rollout.
-- For large production tables, create indexes CONCURRENTLY outside a
-- transaction/migration runner after change-window approval.

-- Customer and restaurant order history: equality filter + descending date.
create index if not exists idx_orders_user_created
  on public.orders(user_id, created_at desc);
create index if not exists idx_orders_restaurant_created
  on public.orders(restaurant_id, created_at desc);

-- Admin order history and main food feed. Avoid duplicating existing
-- single-column indexes when these don't materially improve the plan.
create index if not exists idx_orders_created
  on public.orders(created_at desc);
create index if not exists idx_menu_feed_available_created
  on public.menu_items(created_at desc) where is_available = true;

-- Paid, unassigned deliveries: active rider discovery and history.
create index if not exists idx_delivery_available
  on public.delivery_tracking(updated_at asc)
  where status = 'pending' and delivery_agent_id is null;
create index if not exists idx_delivery_rider_status_updated
  on public.delivery_tracking(delivery_agent_id, status, updated_at desc)
  where delivery_agent_id is not null;

-- Order detail fanout and notification inbox.
create index if not exists idx_order_items_order_id
  on public.order_items(order_id);
create index if not exists idx_notifications_user_created
  on public.notifications(user_id, created_at desc);

-- Approved restaurant discovery sorted by aggregate rating.
create index if not exists idx_restaurants_approved_rating
  on public.restaurants(rating_avg desc, id) where approval_status = 'approved';

-- Safe to re-run. This file does not rewrite any rows or financial records.
