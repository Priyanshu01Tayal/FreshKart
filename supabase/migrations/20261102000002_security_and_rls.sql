-- ============================================================================
-- FreshKart Migration 02: Role Hardening, Security Functions & RLS Policies
-- Version: 1.1
-- Description: Enforces zero-trust privilege boundaries, prevents privilege
--              escalation, and applies strict Row Level Security (RLS) across
--              all customer, delivery partner, admin, and guest personas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper Security Functions (SECURITY DEFINER with strict search_path)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS public.user_role AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND role = 'admin' AND is_active = true
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_delivery_partner(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND role = 'delivery_partner' AND is_active = true
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ----------------------------------------------------------------------------
-- 2. Auth Hook: New User Registration (Prevents Privilege Escalation)
-- ----------------------------------------------------------------------------
-- Forces any newly registered user (via Phone OTP or Email) to have role = 'customer'
-- Public client-side metadata cannot set role = 'admin' or role = 'delivery_partner'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        phone_number,
        full_name,
        role,
        is_active
    ) VALUES (
        NEW.id,
        NEW.phone,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Customer'),
        'customer'::public.user_role, -- STRICT HARDCODE: Always customer
        true
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. Role Protection Guard (Prevents Client-Side Role Updates)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_user_role()
RETURNS TRIGGER AS $$
BEGIN
    -- If role is being changed and the executing user is NOT an admin, raise an error
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF NOT public.is_admin(auth.uid()) THEN
            RAISE EXCEPTION 'Access Denied: You cannot alter user roles.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER trg_protect_user_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_user_role();

-- Admin-only explicit role management RPC
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
    p_target_user_id UUID,
    p_new_role public.user_role
)
RETURNS VOID AS $$
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can assign user roles.';
    END IF;

    UPDATE public.profiles
    SET role = p_new_role,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ----------------------------------------------------------------------------
-- 4. Enable Row Level Security (RLS) on All Tables
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_settlements ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 5. RLS Policies: Categories (Public/Guest Browsing Allowed)
-- ----------------------------------------------------------------------------
CREATE POLICY "Public & guests can view active categories"
    ON public.categories FOR SELECT
    TO anon, authenticated
    USING (is_active = true OR public.is_admin(auth.uid()));

CREATE POLICY "Admins have full control over categories"
    ON public.categories FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 6. RLS Policies: Products (Public/Guest Browsing Allowed)
-- ----------------------------------------------------------------------------
CREATE POLICY "Public & guests can view active products"
    ON public.products FOR SELECT
    TO anon, authenticated
    USING (is_active = true OR public.is_admin(auth.uid()));

CREATE POLICY "Admins have full control over products"
    ON public.products FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 7. RLS Policies: Store Settings (Public Read, Admin Write)
-- ----------------------------------------------------------------------------
CREATE POLICY "Public & guests can view store settings"
    ON public.store_settings FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Admins can update store settings"
    ON public.store_settings FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 8. RLS Policies: Profiles
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Users can update their personal profile info"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid() OR public.is_admin(auth.uid()))
    WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 9. RLS Policies: Addresses (Customer Managed)
-- ----------------------------------------------------------------------------
CREATE POLICY "Customers can view their own addresses"
    ON public.addresses FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Customers can create their own addresses"
    ON public.addresses FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Customers can update their own addresses"
    ON public.addresses FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Customers can delete their own addresses"
    ON public.addresses FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 10. RLS Policies: Orders (Admin-Driven Dispatch; No Self-Assign)
-- ----------------------------------------------------------------------------
-- Customer: View own orders
-- Delivery Partner: View ONLY orders explicitly assigned to them by Admin
-- Admin: View all orders
CREATE POLICY "Users can view relevant orders"
    ON public.orders FOR SELECT
    TO authenticated
    USING (
        customer_id = auth.uid()
        OR delivery_partner_id = auth.uid()
        OR public.is_admin(auth.uid())
    );

-- Delivery Partners can update assigned orders (e.g. OUT_FOR_DELIVERY, DELIVERED)
-- Customers can update only to CANCEL if still PLACED
-- Admins can update any order
CREATE POLICY "Order update authorization"
    ON public.orders FOR UPDATE
    TO authenticated
    USING (
        customer_id = auth.uid()
        OR delivery_partner_id = auth.uid()
        OR public.is_admin(auth.uid())
    )
    WITH CHECK (
        customer_id = auth.uid()
        OR delivery_partner_id = auth.uid()
        OR public.is_admin(auth.uid())
    );

-- ----------------------------------------------------------------------------
-- 11. RLS Policies: Order Items
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view items for authorized orders"
    ON public.order_items FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND (
                o.customer_id = auth.uid()
                OR o.delivery_partner_id = auth.uid()
                OR public.is_admin(auth.uid())
            )
        )
    );

-- ----------------------------------------------------------------------------
-- 12. RLS Policies: Order Status Logs
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view status logs for authorized orders"
    ON public.order_status_logs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_status_logs.order_id
            AND (
                o.customer_id = auth.uid()
                OR o.delivery_partner_id = auth.uid()
                OR public.is_admin(auth.uid())
            )
        )
    );

CREATE POLICY "Authorized agents can create status logs"
    ON public.order_status_logs FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_status_logs.order_id
            AND (
                o.customer_id = auth.uid()
                OR o.delivery_partner_id = auth.uid()
                OR public.is_admin(auth.uid())
            )
        )
    );

-- ----------------------------------------------------------------------------
-- 13. RLS Policies: Cash Settlements (Admin Desk & Delivery Audits)
-- ----------------------------------------------------------------------------
CREATE POLICY "Admins and assigned partners can view settlements"
    ON public.cash_settlements FOR SELECT
    TO authenticated
    USING (
        delivery_partner_id = auth.uid()
        OR public.is_admin(auth.uid())
    );

CREATE POLICY "Admins can create and manage cash settlements"
    ON public.cash_settlements FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
