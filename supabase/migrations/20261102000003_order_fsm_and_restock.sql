-- ============================================================================
-- FreshKart Migration 03: Order Finite State Machine (FSM), Restock & Audit
-- Version: 1.1
-- Description: Enforces strict state transitions on orders, prevents illegal
--              status shifts, executes atomic stock restocking on cancellation,
--              and logs status transitions.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Order State Machine Validator & Timestamp Handler
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_order_state_machine()
RETURNS TRIGGER AS $$
DECLARE
    v_executing_role public.user_role;
    v_is_admin BOOLEAN;
BEGIN
    -- Determine role of caller (handling background/system triggers gracefully)
    v_executing_role := COALESCE(public.get_current_role(), 'customer'::public.user_role);
    v_is_admin := public.is_admin(auth.uid());

    -- If status hasn't changed, allow other permitted column updates
    IF NEW.status = OLD.status THEN
        -- Prevent delivery partner or customer from changing delivery_partner_id
        IF NEW.delivery_partner_id IS DISTINCT FROM OLD.delivery_partner_id AND NOT v_is_admin THEN
            RAISE EXCEPTION 'Access Denied: Only administrators can assign or change delivery partners.';
        END IF;
        RETURN NEW;
    END IF;

    -- Cannot transition from terminal states
    IF OLD.status = 'DELIVERED' THEN
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
                -- Both Customer and Admin can cancel at PLACED
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
                -- Must have an assigned delivery partner
                IF NEW.delivery_partner_id IS NULL THEN
                    RAISE EXCEPTION 'Invalid Operation: Cannot dispatch without an assigned delivery partner.';
                END IF;
                -- Caller must be the assigned delivery partner or admin
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
                -- Mark cash collected at the moment of delivery
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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER trg_enforce_order_state_machine
    BEFORE UPDATE OF status, delivery_partner_id ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.enforce_order_state_machine();

-- ----------------------------------------------------------------------------
-- 2. Automatic Restocking Trigger on Cancellation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_order_cancellation_restock()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'CANCELLED' AND OLD.status != 'CANCELLED' THEN
        -- Atomically restore stock for all line items belonging to the cancelled order
        UPDATE public.products p
        SET stock_quantity = p.stock_quantity + oi.quantity,
            updated_at = timezone('utc'::text, now())
        FROM public.order_items oi
        WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER trg_order_cancellation_restock
    AFTER UPDATE OF status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.handle_order_cancellation_restock();

-- ----------------------------------------------------------------------------
-- 3. Automatic Status Transition Audit Logger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_order_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO public.order_status_logs (
            order_id,
            previous_status,
            new_status,
            changed_by,
            remarks
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            auth.uid(),
            CASE
                WHEN NEW.status = 'CANCELLED' THEN NEW.cancellation_reason
                ELSE 'Status updated to ' || NEW.status::text
            END
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER trg_log_order_status_transition
    AFTER UPDATE OF status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.log_order_status_transition();
