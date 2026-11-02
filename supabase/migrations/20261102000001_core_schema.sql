-- ============================================================================
-- FreshKart Migration 01: Core Schema, Enums, Tables & Indexes
-- Version: 1.1
-- Description: Sets up enums, foundational relational tables, constraints and
--              indexes for quick commerce grocery operations.
-- ============================================================================

-- Ensure standard extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Custom Types & Enums
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('customer', 'delivery_partner', 'admin');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM (
            'PLACED',
            'CONFIRMED',
            'PACKED',
            'OUT_FOR_DELIVERY',
            'DELIVERED',
            'CANCELLED'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cod_status') THEN
        CREATE TYPE cod_status AS ENUM (
            'PENDING_COLLECTION',
            'HELD_BY_PARTNER',
            'SETTLED_WITH_ADMIN'
        );
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Profiles Table (Linked to auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT UNIQUE,
    full_name TEXT NOT NULL DEFAULT 'Customer',
    role user_role NOT NULL DEFAULT 'customer',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 3. Store Settings Table (Single-Hub Singleton Pattern)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    singleton_guard BOOLEAN UNIQUE NOT NULL DEFAULT true CHECK (singleton_guard = true),
    store_name TEXT NOT NULL DEFAULT 'FreshKart Hub 1',
    store_address TEXT NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    delivery_radius_km NUMERIC(5, 2) NOT NULL DEFAULT 5.00 CHECK (delivery_radius_km > 0),
    is_store_open BOOLEAN NOT NULL DEFAULT true,
    is_delivery_available BOOLEAN NOT NULL DEFAULT true,
    min_order_value NUMERIC(10, 2) NOT NULL DEFAULT 99.00 CHECK (min_order_value >= 0),
    standard_delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 25.00 CHECK (standard_delivery_fee >= 0),
    free_delivery_threshold NUMERIC(10, 2) NOT NULL DEFAULT 299.00 CHECK (free_delivery_threshold >= 0),
    contact_phone TEXT NOT NULL DEFAULT '+919999999999',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_by UUID REFERENCES public.profiles(id)
);

-- ----------------------------------------------------------------------------
-- 4. Categories Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    image_url TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 5. Products Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT,
    unit TEXT NOT NULL DEFAULT '1 pc', -- e.g. '500g', '1 kg', '1 L', 'Pack of 4'
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    discount_price NUMERIC(10, 2) CHECK (discount_price IS NULL OR (discount_price >= 0 AND discount_price <= price)),
    image_url TEXT,
    stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    low_stock_threshold INT NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 6. Customer Addresses Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    label TEXT NOT NULL DEFAULT 'Home', -- 'Home', 'Work', 'Other'
    recipient_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    landmark TEXT,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 7. Cash Settlements Table (Admin & Delivery Partner Cash Handover Desk)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_reference TEXT NOT NULL UNIQUE, -- e.g. 'SETTLE-20261102-XXXX'
    delivery_partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    total_orders_settled INT NOT NULL CHECK (total_orders_settled >= 0),
    expected_cash_amount NUMERIC(10, 2) NOT NULL CHECK (expected_cash_amount >= 0),
    actual_cash_received NUMERIC(10, 2) NOT NULL CHECK (actual_cash_received >= 0),
    discrepancy_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discrepancy_notes TEXT,
    settled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 8. Orders Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE, -- Formatted: 'FK-YYYYMMDD-XXXX'
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    delivery_partner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status order_status NOT NULL DEFAULT 'PLACED',
    payment_method TEXT NOT NULL DEFAULT 'COD' CHECK (payment_method = 'COD'),
    cod_status cod_status NOT NULL DEFAULT 'PENDING_COLLECTION',
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (delivery_fee >= 0),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    cod_collected_amount NUMERIC(10, 2) CHECK (cod_collected_amount IS NULL OR cod_collected_amount >= 0),
    cod_collected_at TIMESTAMPTZ,
    cash_settlement_id UUID REFERENCES public.cash_settlements(id) ON DELETE SET NULL,
    delivery_address JSONB NOT NULL,
    customer_notes TEXT,
    cancellation_reason TEXT,
    cancelled_by user_role,
    placed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    confirmed_at TIMESTAMPTZ,
    packed_at TIMESTAMPTZ,
    dispatched_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 9. Order Items Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    unit TEXT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    quantity INT NOT NULL CHECK (quantity > 0),
    total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0)
);

-- ----------------------------------------------------------------------------
-- 10. Order Status Logs (Audit Trail)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_status_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    previous_status order_status,
    new_status order_status NOT NULL,
    changed_by UUID REFERENCES public.profiles(id),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 11. Performance Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active_stock ON public.products(is_active, stock_quantity);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_partner ON public.orders(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_cod_status ON public.orders(cod_status);
CREATE INDEX IF NOT EXISTS idx_orders_placed_at ON public.orders(placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_logs_order ON public.order_status_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON public.addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_settlements_partner ON public.cash_settlements(delivery_partner_id);

-- Enable updated_at auto-refresh helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_addresses_updated_at
    BEFORE UPDATE ON public.addresses
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
