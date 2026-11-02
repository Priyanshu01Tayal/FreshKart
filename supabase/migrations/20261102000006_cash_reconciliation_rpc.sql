-- ============================================================================
-- FreshKart Migration 06: Cash Reconciliation Stored Procedure
-- Version: 1.1
-- Description: Enables store administrators to execute end-of-shift cash
--              settlements with delivery partners, archiving collected cash,
--              reconciling discrepancies, and updating order audit trails.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.settle_delivery_partner_cash(
    p_delivery_partner_id UUID,
    p_actual_cash_received NUMERIC(10, 2),
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID;
    v_total_orders INT;
    v_expected_cash NUMERIC(10, 2);
    v_discrepancy NUMERIC(10, 2);
    v_settlement_id UUID;
    v_settlement_ref TEXT;
BEGIN
    -- 1. Security Check: Only Admin can execute cash settlement
    v_admin_id := auth.uid();
    IF NOT public.is_admin(v_admin_id) THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can execute cash settlements.';
    END IF;

    IF p_actual_cash_received < 0 THEN
        RAISE EXCEPTION 'Actual cash received cannot be negative.';
    END IF;

    -- 2. Aggregate Unsettled Delivered Orders Held by this Partner
    SELECT
        COUNT(*),
        COALESCE(SUM(total_amount), 0.00)
    INTO
        v_total_orders,
        v_expected_cash
    FROM public.orders
    WHERE delivery_partner_id = p_delivery_partner_id
      AND status = 'DELIVERED'
      AND cod_status = 'HELD_BY_PARTNER';

    IF v_total_orders = 0 THEN
        RAISE EXCEPTION 'No pending cash orders found for this delivery partner.';
    END IF;

    -- 3. Calculate Discrepancy
    v_discrepancy := p_actual_cash_received - v_expected_cash;

    -- 4. Generate Settlement Reference
    v_settlement_ref := 'SETTLE-' || to_char(timezone('utc'::text, now()), 'YYYYMMDD') || '-' ||
                        upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    -- 5. Insert Settlement Record
    INSERT INTO public.cash_settlements (
        settlement_reference,
        delivery_partner_id,
        admin_id,
        total_orders_settled,
        expected_cash_amount,
        actual_cash_received,
        discrepancy_amount,
        discrepancy_notes,
        settled_at
    ) VALUES (
        v_settlement_ref,
        p_delivery_partner_id,
        v_admin_id,
        v_total_orders,
        v_expected_cash,
        p_actual_cash_received,
        v_discrepancy,
        p_notes,
        timezone('utc'::text, now())
    )
    RETURNING id INTO v_settlement_id;

    -- 6. Mark All Associated Orders as Settled
    UPDATE public.orders
    SET cod_status = 'SETTLED_WITH_ADMIN',
        cash_settlement_id = v_settlement_id,
        updated_at = timezone('utc'::text, now())
    WHERE delivery_partner_id = p_delivery_partner_id
      AND status = 'DELIVERED'
      AND cod_status = 'HELD_BY_PARTNER';

    -- 7. Return Summary Payload
    RETURN jsonb_build_object(
        'success', true,
        'settlement_id', v_settlement_id,
        'settlement_reference', v_settlement_ref,
        'delivery_partner_id', p_delivery_partner_id,
        'total_orders_settled', v_total_orders,
        'expected_cash_amount', v_expected_cash,
        'actual_cash_received', p_actual_cash_received,
        'discrepancy_amount', v_discrepancy,
        'settled_at', timezone('utc'::text, now())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
