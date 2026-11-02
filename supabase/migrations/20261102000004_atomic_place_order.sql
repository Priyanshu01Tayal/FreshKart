-- ============================================================================
-- FreshKart Migration 04: Atomic Order Placement RPC
-- Version: 1.1
-- Description: Core atomic transaction procedure for placing quick commerce
--              orders. Performs store open checks, operational radius checks,
--              minimum order checks, row-level inventory locks (FOR UPDATE),
--              server-side price evaluation, and atomic stock decrements.
-- ============================================================================

-- Haversine Distance Helper in Kilometers
CREATE OR REPLACE FUNCTION public.calculate_haversine_km(
    lat1 NUMERIC, lon1 NUMERIC,
    lat2 NUMERIC, lon2 NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
    r NUMERIC := 6371.0; -- Earth radius in KM
    dlat NUMERIC;
    dlon NUMERIC;
    a NUMERIC;
    c NUMERIC;
BEGIN
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);

    a := (sin(dlat / 2.0) ^ 2) +
         cos(radians(lat1)) * cos(radians(lat2)) * (sin(dlon / 2.0) ^ 2);

    -- Protect against precision float drift beyond 1.0
    IF a > 1.0 THEN a := 1.0; END IF;

    c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
    RETURN ROUND((r * c)::NUMERIC, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ----------------------------------------------------------------------------
-- Atomic Checkout Stored Procedure
-- ----------------------------------------------------------------------------
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

    -- 5. Calculate Distance & Validate Delivery Radius
    v_distance_km := public.calculate_haversine_km(
        v_store.latitude, v_store.longitude,
        v_address.latitude, v_address.longitude
    );

    IF v_distance_km > v_store.delivery_radius_km THEN
        RAISE EXCEPTION 'Address is outside our % km delivery radius (current distance: % km).',
            v_store.delivery_radius_km, v_distance_km;
    END IF;

    -- 6. Lock Products & Calculate Server-Authoritative Subtotal
    -- We extract item rows from JSONB: [{ product_id: UUID, quantity: INT }]
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
        -- Prevents race conditions from concurrent checkouts
        SELECT * INTO v_prod
        FROM public.products
        WHERE id = v_item.product_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product with ID % not found.', v_item.product_id;
        END IF;

        IF NOT v_prod.is_active THEN
            RAISE EXCEPTION 'Product "%" is no longer available.', v_prod.name;
        END IF;

        IF v_prod.stock_quantity < v_item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for "%". Only % left in stock.',
                v_prod.name, v_prod.stock_quantity;
        END IF;

        -- Server determines effective price: discount_price takes precedence if valid
        v_effective_price := COALESCE(v_prod.discount_price, v_prod.price);
        v_line_total := ROUND((v_effective_price * v_item.quantity)::NUMERIC, 2);
        v_subtotal := v_subtotal + v_line_total;
    END LOOP;

    -- 7. Minimum Order Value Check
    IF v_subtotal < v_store.min_order_value THEN
        RAISE EXCEPTION 'Minimum order value is ₹%. Current subtotal is ₹%.',
            v_store.min_order_value, v_subtotal;
    END IF;

    -- 8. Delivery Fee Calculation
    IF v_subtotal >= v_store.free_delivery_threshold THEN
        v_delivery_fee := 0.00;
    ELSE
        v_delivery_fee := v_store.standard_delivery_fee;
    END IF;

    v_total_amount := v_subtotal + v_delivery_fee;

    -- 9. Generate Human-Readable Order Number (FK-YYYYMMDD-XXXX)
    v_order_number := 'FK-' || to_char(timezone('utc'::text, now()), 'YYYYMMDD') || '-' ||
                      upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    -- 10. Insert Order Record
    INSERT INTO public.orders (
        order_number,
        customer_id,
        status,
        payment_method,
        cod_status,
        subtotal,
        delivery_fee,
        total_amount,
        delivery_address,
        customer_notes,
        placed_at
    ) VALUES (
        v_order_number,
        v_user_id,
        'PLACED',
        'COD',
        'PENDING_COLLECTION',
        v_subtotal,
        v_delivery_fee,
        v_total_amount,
        jsonb_build_object(
            'address_id', v_address.id,
            'label', v_address.label,
            'recipient_name', v_address.recipient_name,
            'phone', v_address.phone,
            'address_line1', v_address.address_line1,
            'address_line2', v_address.address_line2,
            'landmark', v_address.landmark,
            'latitude', v_address.latitude,
            'longitude', v_address.longitude,
            'distance_km', v_distance_km
        ),
        p_customer_notes,
        timezone('utc'::text, now())
    )
    RETURNING id INTO v_order_id;

    -- 11. Insert Order Items & Decrement Stock Quantity
    FOR v_item IN
        SELECT
            (x->>'product_id')::UUID AS product_id,
            (x->>'quantity')::INT AS quantity
        FROM jsonb_array_elements(p_items) AS x
    LOOP
        SELECT * INTO v_prod FROM public.products WHERE id = v_item.product_id;
        v_effective_price := COALESCE(v_prod.discount_price, v_prod.price);
        v_line_total := ROUND((v_effective_price * v_item.quantity)::NUMERIC, 2);

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
            v_line_total
        );

        -- Atomically decrement stock
        UPDATE public.products
        SET stock_quantity = stock_quantity - v_item.quantity,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_prod.id;
    END LOOP;

    -- 12. Log Initial Order Status
    INSERT INTO public.order_status_logs (
        order_id,
        previous_status,
        new_status,
        changed_by,
        remarks
    ) VALUES (
        v_order_id,
        NULL,
        'PLACED',
        v_user_id,
        'Order successfully placed via COD'
    );

    -- 13. Return Order Confirmation Payload
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'subtotal', v_subtotal,
        'delivery_fee', v_delivery_fee,
        'total_amount', v_total_amount,
        'placed_at', timezone('utc'::text, now())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

