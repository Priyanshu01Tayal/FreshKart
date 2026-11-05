-- ============================================================================
-- FreshKart Migration 08: Delivery Zone Serviceability & Order Idempotency
-- Version: 1.1
-- Description: Adds serviceable_pincodes to store_settings for server-authoritative
--              delivery zone validation. Adds idempotency_key to orders table.
--              Enhances place_order() RPC with strict serviceability, server-side pricing,
--              atomic stock reduction, and idempotency.
--              Adds cancel_order() RPC with FSM protection and automatic restocking.
-- ============================================================================

-- 1. Add serviceable_pincodes allowlist to store_settings
ALTER TABLE public.store_settings
    ADD COLUMN IF NOT EXISTS serviceable_pincodes TEXT[] NOT NULL
    DEFAULT ARRAY['560034', '560095', '560068', '560078', '560102', '560103'];

-- 2. Add idempotency_key to orders table to prevent duplicate submissions
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON public.orders(idempotency_key);

-- 3. Enhanced atomic place_order() RPC
CREATE OR REPLACE FUNCTION public.place_order(
    p_address_id UUID,
    p_items JSONB,
    p_customer_notes TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_store public.store_settings%ROWTYPE;
    v_address public.addresses%ROWTYPE;
    v_distance_km NUMERIC := NULL;
    v_order_id UUID;
    v_order_number TEXT;
    v_subtotal NUMERIC(10, 2) := 0.00;
    v_delivery_fee NUMERIC(10, 2) := 0.00;
    v_total_amount NUMERIC(10, 2) := 0.00;

    -- Existing order check for idempotency
    v_existing_order RECORD;

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

    -- 2. Idempotency Check (prevent duplicate orders on repeated taps or network retries)
    IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
        SELECT id, order_number, subtotal, delivery_fee, total_amount, status
        INTO v_existing_order
        FROM public.orders
        WHERE idempotency_key = p_idempotency_key AND customer_id = v_user_id;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'order_id', v_existing_order.id,
                'order_number', v_existing_order.order_number,
                'subtotal', v_existing_order.subtotal,
                'delivery_fee', v_existing_order.delivery_fee,
                'total_amount', v_existing_order.total_amount,
                'status', v_existing_order.status,
                'is_duplicate_request', true
            );
        END IF;
    END IF;

    -- 3. Validate Items Array
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cart is empty. Please add items to your cart.';
    END IF;

    -- 4. Validate Store Status
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

    -- 5. Validate Delivery Address Ownership
    SELECT * INTO v_address
    FROM public.addresses
    WHERE id = p_address_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid delivery address selected.';
    END IF;

    -- 6. Server-Authoritative Delivery Serviceability Validation
    -- Rule A: PIN Code Allowlist Check
    IF v_store.serviceable_pincodes IS NOT NULL AND array_length(v_store.serviceable_pincodes, 1) > 0 THEN
        IF v_address.pincode IS NULL OR NOT (v_address.pincode = ANY(v_store.serviceable_pincodes)) THEN
            RAISE EXCEPTION 'Delivery is not available in PIN code %. We currently deliver only to: %',
                COALESCE(v_address.pincode, 'Unknown'),
                array_to_string(v_store.serviceable_pincodes, ', ');
        END IF;
    ELSE
        -- If no pincodes configured, address must have verified coordinates within delivery radius
        IF v_address.latitude IS NULL OR v_address.longitude IS NULL THEN
            RAISE EXCEPTION 'Delivery verification requires valid location coordinates for PIN code %.', v_address.pincode;
        END IF;
    END IF;

    -- Rule B: If GPS coordinates are present, also enforce delivery radius check
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

    -- 7. Lock Products & Calculate Server-Authoritative Subtotal
    FOR v_item IN
        SELECT
            (x->>'product_id')::UUID AS product_id,
            (x->>'quantity')::INT AS quantity
        FROM jsonb_array_elements(p_items) AS x
    LOOP
        IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
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

        -- Server-evaluated pricing: discount_price takes precedence if valid
        IF v_prod.discount_price IS NOT NULL AND v_prod.discount_price >= 0 THEN
            v_effective_price := v_prod.discount_price;
        ELSE
            v_effective_price := v_prod.price;
        END IF;

        v_line_total := ROUND((v_effective_price * v_item.quantity)::NUMERIC, 2);
        v_subtotal := v_subtotal + v_line_total;
    END LOOP;

    -- 8. Minimum Order Value Check
    IF v_subtotal < v_store.min_order_value THEN
        RAISE EXCEPTION 'Order subtotal of ₹% is below minimum order value of ₹%.',
            v_subtotal, v_store.min_order_value;
    END IF;

    -- 9. Delivery Fee Evaluation
    IF v_subtotal >= v_store.free_delivery_threshold THEN
        v_delivery_fee := 0.00;
    ELSE
        v_delivery_fee := v_store.standard_delivery_fee;
    END IF;

    v_total_amount := v_subtotal + v_delivery_fee;

    -- 10. Generate Human-Readable Order Number (FK-YYYYMMDD-XXXX)
    v_order_number := 'FK-' || to_char(timezone('utc'::text, now()), 'YYYYMMDD') || '-' ||
                      upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    -- 11. Insert Order Record with Address Snapshot
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
        idempotency_key,
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
            'id', v_address.id,
            'recipient_name', v_address.recipient_name,
            'phone', v_address.phone,
            'address_line1', v_address.address_line1,
            'address_line2', v_address.address_line2,
            'landmark', v_address.landmark,
            'city', v_address.city,
            'state', v_address.state,
            'pincode', v_address.pincode,
            'latitude', v_address.latitude,
            'longitude', v_address.longitude,
            'distance_km', v_distance_km
        ),
        p_customer_notes,
        p_idempotency_key,
        timezone('utc'::text, now())
    )
    RETURNING id INTO v_order_id;

    -- 12. Insert Order Line Items & Decrement Inventory
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

    -- 13. Insert Initial Order Status Log
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
        'Order placed successfully via Cash on Delivery'
    );

    -- 14. Return Order Confirmation Summary
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Customer & Admin cancel_order() RPC
CREATE OR REPLACE FUNCTION public.cancel_order(
    p_order_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_role public.user_role;
    v_order public.orders%ROWTYPE;
    v_effective_reason TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to cancel order.';
    END IF;

    v_role := public.get_current_role();

    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found.';
    END IF;

    -- Customer authorization: can only cancel their own order
    IF v_role = 'customer' AND v_order.customer_id <> v_user_id THEN
        RAISE EXCEPTION 'Access Denied: You can only cancel your own orders.';
    END IF;

    -- State Machine Guard: Customer can ONLY cancel when status is 'PLACED'
    IF v_role = 'customer' AND v_order.status <> 'PLACED' THEN
        RAISE EXCEPTION 'Cannot cancel order once confirmed or dispatched. Current status: %', v_order.status;
    END IF;

    -- Already terminal
    IF v_order.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Order is already cancelled.';
    END IF;

    IF v_order.status = 'DELIVERED' THEN
        RAISE EXCEPTION 'Delivered orders cannot be cancelled.';
    END IF;

    v_effective_reason := COALESCE(trim(p_reason), 'Cancelled by ' || v_role::text);

    -- Update order status to CANCELLED.
    -- This triggers trg_enforce_order_state_machine, trg_order_cancellation_restock, and trg_log_order_status_transition.
    UPDATE public.orders
    SET
        status = 'CANCELLED',
        cancellation_reason = v_effective_reason,
        cancelled_by = v_role,
        cancelled_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'status', 'CANCELLED',
        'cancellation_reason', v_effective_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

