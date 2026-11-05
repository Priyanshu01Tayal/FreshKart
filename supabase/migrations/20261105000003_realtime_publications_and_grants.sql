-- ============================================================================
-- FreshKart Migration 10: Realtime Publications & Explicit Permission Grants
-- Version: 1.1
-- Description:
--   1. Configures Supabase Realtime publication for orders, products,
--      store_settings, and categories to support live status sync.
--   2. Explicitly grants role permissions (anon, authenticated) for tables
--      and stored procedures (RPCs).
-- ============================================================================

-- 1. Realtime Publication Configuration
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND tablename = 'products'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND tablename = 'store_settings'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.store_settings;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND tablename = 'categories'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
        END IF;
    END IF;
END $$;

-- 2. Schema Usage
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 3. Public / Guest Catalog Permissions
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.products TO anon, authenticated;
GRANT SELECT ON public.store_settings TO anon, authenticated;

-- 4. Customer & Partner Permissions (Protected by RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT SELECT, INSERT ON public.order_status_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cash_settlements TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- 5. Stored Procedure (RPC) Execution Grants
GRANT EXECUTE ON FUNCTION public.place_order(UUID, JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_delivery_partner_cash(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(UUID, public.user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_haversine_km(NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_delivery_partner(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_role() TO anon, authenticated;

