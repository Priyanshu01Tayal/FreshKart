-- ============================================================================
-- FreshKart Migration 09: Production Hardening (Serviceability, GPS & COD Integrity)
-- Version: 1.1
-- Description:
--   1. Removes hardcoded city/postal defaults. Sets store_settings.serviceable_pincodes
--      default to an empty array. Prevents order placement when zones are unconfigured.
--   2. Hardens GPS security: coordinates can never bypass the PIN code allowlist,
--      geographic bounds checks are enforced, and radius constraints are strictly validated.
--   3. Hardens COD lifecycle: prevents inconsistent order status and COD collection,
--      ensures cash collection is recorded only through authorized delivery transitions.
-- ============================================================================

-- 1. Reset serviceable_pincodes default to empty array (unconfigured launch zone)
ALTER TABLE public.store_settings
    ALTER COLUMN serviceable_pincodes SET DEFAULT '{}'::TEXT[];

-- 2. Update address column defaults to generic empty values (removing city-specific defaults)
ALTER TABLE public.addresses
    ALTER COLUMN city DROP DEFAULT,
    ALTER COLUMN state DROP DEFAULT,
    ALTER COLUMN pincode DROP DEFAULT;

-- 3. Hardened Atomic place_order() RPC
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

    -- 2. Idempotency Check (prevent duplicate orders on retries / app restarts)
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

    -- 4. Validate Store Operational Switches
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

    -- 6. Server-Authoritative Delivery Serviceability & GPS Security
    -- RULE A: Prevent orders if administrator has not configured serviceable PIN codes
    IF v_store.serviceable_pincodes IS NULL OR array_length(v_store.serviceable_pincodes, 1) IS NULL OR array_length(v_store.serviceable_pincodes, 1) = 0 THEN
        RAISE EXCEPTION 'Store delivery zones are not yet configured by administrator. Orders cannot be accepted at this time.';
    END IF;

    -- RULE B: Address PIN code MUST exist in the allowlist. Arbitrary customer GPS coordinates
    -- cannot bypass this allowlist.
    IF v_address.pincode IS NULL OR NOT (v_address.pincode = ANY(v_store.serviceable_pincodes)) THEN
        RAISE EXCEPTION 'Delivery is not available in PIN code %. We currently deliver only to: %',
            COALESCE(v_address.pincode, 'Unknown'),
            array_to_string(v_store.serviceable_pincodes, ', ');
    END IF;

    -- RULE C: If coordinates are provided, perform geographic bounds validation and enforce delivery radius
    IF v_address.latitude IS NOT NULL AND v_address.longitude IS NOT NULL THEN
        -- Check bounds
        IF v_address.latitude < -90.0 OR v_address.latitude > 90.0 OR
           v_address.longitude < -180.0 OR v_address.longitude > 180.0 THEN
            RAISE EXCEPTION 'Invalid geographic coordinates provided.';
        END IF;

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

    -- 11. Insert Order Record with Complete Snapshot
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

-- 4. Hardened State Machine & COD Lifecycle Trigger
CREATE OR REPLACE FUNCTION public.enforce_order_state_machine()
RETURNS TRIGGER AS $$
DECLARE
    v_executing_role public.user_role;
    v_is_admin BOOLEAN;
BEGIN
    v_executing_role := COALESCE(public.get_current_role(), 'customer'::public.user_role);
    v_is_admin := public.is_admin(auth.uid());

    -- COD Lifecycle Security Audit:
    -- Customers can NEVER update cod_status, cod_collected_amount, or delivery_partner_id
    IF NOT v_is_admin THEN
        IF NEW.delivery_partner_id IS DISTINCT FROM OLD.delivery_partner_id THEN
            RAISE EXCEPTION 'Access Denied: Only administrators can assign or change delivery partners.';
        END IF;

        IF v_executing_role = 'customer' THEN
            IF NEW.cod_status IS DISTINCT FROM OLD.cod_status OR
               NEW.cod_collected_amount IS DISTINCT FROM OLD.cod_collected_amount OR
               NEW.cod_collected_at IS DISTINCT FROM OLD.cod_collected_at OR
               NEW.cash_settlement_id IS DISTINCT FROM OLD.cash_settlement_id THEN
                RAISE EXCEPTION 'Access Denied: Customers cannot modify cash collection or settlement data.';
            END IF;
        END IF;
    END IF;

    -- If status hasn't changed
    IF NEW.status = OLD.status THEN
        -- Allow settlement update ONLY if admin and moving to SETTLED_WITH_ADMIN
        IF NEW.cod_status IS DISTINCT FROM OLD.cod_status THEN
            IF NEW.cod_status = 'SETTLED_WITH_ADMIN' THEN
                IF NOT v_is_admin THEN
                    RAISE EXCEPTION 'Access Denied: Only administrators can reconcile cash settlements.';
                END IF;
                IF OLD.cod_status <> 'HELD_BY_PARTNER' THEN
                    RAISE EXCEPTION 'Invalid Settlement: Only orders held by delivery partner can be settled.';
                END IF;
                IF NEW.cash_settlement_id IS NULL THEN
                    RAISE EXCEPTION 'Invalid Settlement: Settlement reference ID is required.';
                END IF;
            ELSE
                RAISE EXCEPTION 'Invalid COD Status Modification: Cannot manually modify cash status without delivery status change.';
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    -- Terminal states cannot be altered
    IF OLD.status = 'DELIVERED' THEN
        -- Only permit settlement metadata if already delivered
        IF v_is_admin AND NEW.cod_status = 'SETTLED_WITH_ADMIN' AND NEW.cash_settlement_id IS NOT NULL THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Invalid State Transition: Delivered orders cannot be modified.';
    END IF;

    IF OLD.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Invalid State Transition: Cancelled orders cannot be modified.';
    END IF;

    -- Strict State Transition Matrix
    CASE OLD.status
        WHEN 'PLACED' THEN
            IF NEW.status = 'CONFIRMED' THEN
                IF NOT v_is_admin THEN
                    RAISE EXCEPTION 'Access Denied: Only administrators can confirm orders.';
                END IF;
                NEW.confirmed_at := timezone('utc'::text, now());

            ELSIF NEW.status = 'CANCELLED' THEN
                IF NOT (v_is_admin OR auth.uid() = OLD.customer_id) THEN
                    RAISE EXCEPTION 'Access Denied: You cannot cancel this order.';
                END IF;
                NEW.cancelled_at := timezone('utc'::text, now());
                NEW.cancelled_by := v_executing_role;

            ELSE
                RAISE EXCEPTION 'Invalid State Transition: Order in PLACED state can only move to CONFIRMED or CANCELLED.';
            END IF;

        WHEN 'CONFIRMED' THEN
            IF NEW.status = 'PACKED' THEN
                IF NOT v_is_admin THEN
                    RAISE EXCEPTION 'Access Denied: Only administrators can mark orders as PACKED.';
                END IF;
                NEW.packed_at := timezone('utc'::text, now());

            ELSIF NEW.status = 'CANCELLED' THEN
                IF NOT v_is_admin THEN
                    RAISE EXCEPTION 'Customer cannot cancel once order is confirmed. Contact store support.';
                END IF;
                NEW.cancelled_at := timezone('utc'::text, now());
                NEW.cancelled_by := 'admin';

            ELSE
                RAISE EXCEPTION 'Invalid State Transition: Order in CONFIRMED state can only move to PACKED or CANCELLED.';
            END IF;

        WHEN 'PACKED' THEN
            IF NEW.status = 'OUT_FOR_DELIVERY' THEN
                IF NEW.delivery_partner_id IS NULL THEN
                    RAISE EXCEPTION 'Invalid Operation: Cannot dispatch without an assigned delivery partner.';
                END IF;
                IF NOT (v_is_admin OR auth.uid() = NEW.delivery_partner_id) THEN
                    RAISE EXCEPTION 'Access Denied: Only the assigned delivery partner or an admin can dispatch this order.';
                END IF;
                NEW.dispatched_at := timezone('utc'::text, now());

            ELSIF NEW.status = 'CANCELLED' THEN
                IF NOT v_is_admin THEN
                    RAISE EXCEPTION 'Access Denied: Only administrators can cancel packed orders.';
                END IF;
                NEW.cancelled_at := timezone('utc'::text, now());
                NEW.cancelled_by := 'admin';

            ELSE
                RAISE EXCEPTION 'Invalid State Transition: Order in PACKED state can only move to OUT_FOR_DELIVERY or CANCELLED.';
            END IF;

        WHEN 'OUT_FOR_DELIVERY' THEN
            IF NEW.status = 'DELIVERED' THEN
                IF NOT (v_is_admin OR auth.uid() = OLD.delivery_partner_id) THEN
                    RAISE EXCEPTION 'Access Denied: Only the assigned delivery partner or an admin can complete delivery.';
                END IF;
                NEW.delivered_at := timezone('utc'::text, now());
                -- Cash collection is recorded atomically upon delivery completion
                NEW.cod_status := 'HELD_BY_PARTNER';
                NEW.cod_collected_amount := COALESCE(NEW.cod_collected_amount, OLD.total_amount);
                NEW.cod_collected_at := timezone('utc'::text, now());

            ELSIF NEW.status = 'CANCELLED' THEN
                IF NOT v_is_admin THEN
                    RAISE EXCEPTION 'Access Denied: Only administrators can cancel dispatched orders.';
                END IF;
                NEW.cancelled_at := timezone('utc'::text, now());
                NEW.cancelled_by := 'admin';

            ELSE
                RAISE EXCEPTION 'Invalid State Transition: Dispatched order can only move to DELIVERED or CANCELLED.';
            END IF;

        ELSE
            RAISE EXCEPTION 'Unknown order status: %', OLD.status;
    END CASE;

    -- Enforce cancellation reason if status becomes CANCELLED
    IF NEW.status = 'CANCELLED' AND (NEW.cancellation_reason IS NULL OR trim(NEW.cancellation_reason) = '') THEN
        NEW.cancellation_reason := 'Cancelled by ' || v_executing_role::text;
    END IF;

    -- INVARIANT CHECK: Delivered orders must have cod_status HELD_BY_PARTNER or SETTLED_WITH_ADMIN
    IF NEW.status = 'DELIVERED' AND NEW.cod_status = 'PENDING_COLLECTION' THEN
        RAISE EXCEPTION 'Consistency Violation: Delivered order cannot have PENDING_COLLECTION cash status.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_order_state_machine ON public.orders;

CREATE TRIGGER trg_enforce_order_state_machine
    BEFORE UPDATE OF status, delivery_partner_id, cod_status, cod_collected_amount ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.enforce_order_state_machine();

