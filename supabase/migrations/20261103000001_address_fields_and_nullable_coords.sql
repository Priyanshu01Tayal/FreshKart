-- ============================================================================
-- FreshKart Migration 07: Address Fields Extension & Safe Coordinates
-- Version: 1.1
-- Description: Adds city, state, and pincode columns to addresses table.
--              Makes GPS coordinates nullable for manual address entry.
--              Updates place_order() RPC to validate radius conditionally when
--              coordinates are present.
-- ============================================================================

-- 1. Add city, state, pincode columns to addresses table
ALTER TABLE public.addresses
    ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT 'Bengaluru',
    ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'Karnataka',
    ADD COLUMN IF NOT EXISTS pincode TEXT NOT NULL DEFAULT '560034';

-- 2. Allow manual address entry without forcing fabricated coordinates
ALTER TABLE public.addresses
    ALTER COLUMN latitude DROP NOT NULL,
    ALTER COLUMN longitude DROP NOT NULL;

-- 3. Update place_order() to support addresses with or without map coordinates
CREATE OR REPLACE FUNCTION public.place_order(
    p_address_id UUID,
    p_items JSONB,
    p_customer_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_store public.store_settings%ROWTYPE;
    v_address public.addresses%ROWTYPE;
    v_distance_km NUMERIC;
    v_order_id UUID;
    v_order_number TEXT;
    v_subtotal NUMERIC(10, 2) := 0.00;
    v_delivery_fee NUMERIC(10, 2) := 0.00;
    v_total_amount NUMERIC(10, 2) := 0.00;

    -- Cursor variables for items
    v_item RECORD;
    v_prod public.products%ROWTYPE;
    v_effective_price NUMERIC(10, 2);
    v_line_total NUMERIC(10, 2);
BEGIN
    -- 1. Authentication Check
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: You must be logged in to place an order.';
    END IF;

    -- 2. Validate Items Array
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cart is empty. Please add items to your cart.';
    END IF;

    -- 3. Validate Store Status
    SELECT * INTO v_store FROM public.store_settings LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Store configuration not found.';
    END IF;

    IF NOT v_store.is_store_open THEN
        RAISE EXCEPTION 'FreshKart store is currently closed. Please check back during operating hours.';
    END IF;

    IF NOT v_store.is_delivery_available THEN
        RAISE EXCEPTION 'Delivery services are temporarily paused. Please try again shortly.';
    END IF;

    -- 4. Validate Delivery Address
    SELECT * INTO v_address
    FROM public.addresses
    WHERE id = p_address_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid delivery address selected.';
    END IF;

    -- 5. Calculate Distance & Validate Delivery Radius if coordinates exist
    IF v_address.latitude IS NOT NULL AND v_address.longitude IS NOT NULL THEN
        v_distance_km := public.calculate_haversine_km(
            v_store.latitude, v_store.longitude,
            v_address.latitude, v_address.longitude
        );

        IF v_distance_km > v_store.delivery_radius_km THEN
            RAISE EXCEPTION 'Address is outside our % km delivery radius (current distance: % km).',
                v_store.delivery_radius_km, v_distance_km;
        END IF;
    END IF;

    -- 6. Lock Products & Calculate Server-Authoritative Subtotal
    FOR v_item IN
        SELECT
            (x->>'product_id')::UUID AS product_id,
            (x->>'quantity')::INT AS quantity
        FROM jsonb_array_elements(p_items) AS x
    LOOP
        IF v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Quantity for all items must be greater than zero.';
        END IF;

        -- ACQUIRE ROW-LEVEL LOCK (FOR UPDATE)
        SELECT * INTO v_prod
        FROM public.products
        WHERE id = v_item.product_id AND is_active = true
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % is unavailable or discontinued.', v_item.product_id;
        END IF;

        -- Check available stock
        IF v_prod.stock_quantity < v_item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for "%". Requested: %, Available: %.',
                v_prod.name, v_item.quantity, v_prod.stock_quantity;
        END IF;

        -- Server-evaluated pricing
        IF v_prod.discount_price IS NOT NULL AND v_prod.discount_price >= 0 THEN
            v_effective_price := v_prod.discount_price;
        ELSE
            v_effective_price := v_prod.price;
        END IF;

        v_line_total := v_effective_price * v_item.quantity;
        v_subtotal := v_subtotal + v_line_total;
    END LOOP;

    -- 7. Minimum Order Value Check
    IF v_subtotal < v_store.min_order_value THEN
        RAISE EXCEPTION 'Order subtotal of ₹% is below minimum order value of ₹%.',
            v_subtotal, v_store.min_order_value;
    END IF;

    -- 8. Delivery Fee Evaluation
    IF v_subtotal >= v_store.free_delivery_threshold THEN
        v_delivery_fee := 0.00;
    ELSE
        v_delivery_fee := v_store.standard_delivery_fee;
    END IF;

    v_total_amount := v_subtotal + v_delivery_fee;

    -- 9. Generate Human-Readable Order Number (e.g. FK-YYYYMMDD-XXXX)
    v_order_number := 'FK-' || to_char(now(), 'YYYYMMDD') || '-' ||
                      upper(substr(gen_random_uuid()::TEXT, 1, 6));

    -- 10. Insert Order Record
    INSERT INTO public.orders (
        order_number,
        customer_id,
        delivery_address_id,
        status,
        subtotal,
        delivery_fee,
        total_amount,
        customer_notes,
        cod_status
    ) VALUES (
        v_order_number,
        v_user_id,
        p_address_id,
        'PLACED',
        v_subtotal,
        v_delivery_fee,
        v_total_amount,
        p_customer_notes,
        'PENDING_COLLECTION'
    )
    RETURNING id INTO v_order_id;

    -- 11. Insert Order Line Items & Decrement Inventory
    FOR v_item IN
        SELECT
            (x->>'product_id')::UUID AS product_id,
            (x->>'quantity')::INT AS quantity
        FROM jsonb_array_elements(p_items) AS x
    LOOP
        SELECT * INTO v_prod FROM public.products WHERE id = v_item.product_id;

        IF v_prod.discount_price IS NOT NULL AND v_prod.discount_price >= 0 THEN
            v_effective_price := v_prod.discount_price;
        ELSE
            v_effective_price := v_prod.price;
        END IF;

        -- Record line item
        INSERT INTO public.order_items (
            order_id,
            product_id,
            product_name,
            unit,
            unit_price,
            quantity,
            total_price
        ) VALUES (
            v_order_id,
            v_prod.id,
            v_prod.name,
            v_prod.unit,
            v_effective_price,
            v_item.quantity,
            v_effective_price * v_item.quantity
        );

        -- Decrement stock atomically
        UPDATE public.products
        SET
            stock_quantity = stock_quantity - v_item.quantity,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_prod.id;
    END LOOP;

    -- 12. Return Order Confirmation Summary
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'subtotal', v_subtotal,
        'delivery_fee', v_delivery_fee,
        'total_amount', v_total_amount,
        'status', 'PLACED'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

