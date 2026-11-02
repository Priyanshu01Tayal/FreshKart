import React, { useState } from 'react';
import {
  Coins,
  CheckCircle2,
  AlertTriangle,
  History,
  ArrowRight,
  UserCheck,
  Receipt
} from 'lucide-react';
import type { Database } from '@freshkart/shared';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Order = Database['public']['Tables']['orders']['Row'];
type CashSettlement = Database['public']['Tables']['cash_settlements']['Row'];

interface CashReconciliationProps {
  deliveryPartners: Profile[];
  orders: Order[];
  settlements: CashSettlement[];
  onExecuteSettlement: (partnerId: string, actualCash: number, notes?: string) => Promise<void>;
  isLoading: boolean;
}

export const CashReconciliation: React.FC<CashReconciliationProps> = ({
  deliveryPartners,
  orders,
  settlements,
  onExecuteSettlement,
  isLoading,
}) => {
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(
    deliveryPartners[0]?.id || ''
  );
  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [discrepancyNotes, setDiscrepancyNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Orders delivered by this partner that are currently HELD_BY_PARTNER
  const pendingOrders = orders.filter(
    (o) =>
      o.delivery_partner_id === selectedPartnerId &&
      o.status === 'DELIVERED' &&
      o.cod_status === 'HELD_BY_PARTNER'
  );

  const expectedCash = pendingOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const actualCash = parseFloat(actualCashInput) || 0;
  const discrepancy = actualCash - expectedCash;

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartnerId) return;
    if (pendingOrders.length === 0) {
      setActionError('This partner does not currently hold any unsettled cash orders.');
      return;
    }
    if (isNaN(actualCash) || actualCash < 0) {
      setActionError('Please enter a valid cash amount received.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await onExecuteSettlement(
        selectedPartnerId,
        actualCash,
        discrepancyNotes.trim() || undefined
      );
      setActionSuccess(
        `Successfully settled ₹${actualCash.toFixed(2)} with ${
          deliveryPartners.find((p) => p.id === selectedPartnerId)?.full_name
        }. All ${pendingOrders.length} orders updated to SETTLED_WITH_ADMIN.`
      );
      setActualCashInput('');
      setDiscrepancyNotes('');
      setTimeout(() => setActionSuccess(null), 6000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cash reconciliation failed';
      setActionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#17251C]">COD Cash Reconciliation Desk</h1>
        <p className="text-sm text-gray-500">
          Reconcile physical cash handovers with delivery partners at the end of each shift.
        </p>
      </div>

      {actionSuccess && (
        <div className="flex items-center space-x-2 rounded-2xl bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="flex items-start space-x-2 rounded-2xl bg-red-50 p-4 text-xs text-red-700 border border-red-200">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Settlement Action Form (1 Column) */}
        <div className="rounded-2xl border border-[#E0EFE4] bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center space-x-2">
            <Coins className="h-4 w-4 text-[#168447]" />
            <span>Cash Handover Desk</span>
          </h2>

          <form onSubmit={handleSettle} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Select Delivery Partner
              </label>
              <select
                value={selectedPartnerId}
                onChange={(e) => {
                  setSelectedPartnerId(e.target.value);
                  setActualCashInput('');
                  setDiscrepancyNotes('');
                  setActionError(null);
                }}
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-[#17251C] outline-none focus:border-[#168447]"
              >
                {deliveryPartners.map((dp) => (
                  <option key={dp.id} value={dp.id}>
                    {dp.full_name} ({dp.phone_number || 'Rider'})
                  </option>
                ))}
              </select>
            </div>

            {/* Expected Summary Card */}
            <div className="rounded-xl bg-[#F5FAF5] p-3.5 space-y-2 border border-emerald-100">
              <div className="flex justify-between text-gray-600">
                <span>Unsettled Delivered Orders:</span>
                <span className="font-bold text-[#17251C]">{pendingOrders.length}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Expected Cash Total:</span>
                <span className="font-extrabold text-base text-[#168447]">
                  ₹{expectedCash.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Actual Cash Input */}
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Actual Physical Cash Received (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={actualCashInput}
                onChange={(e) => setActualCashInput(e.target.value)}
                placeholder="Enter physical cash handed over"
                required
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-[#17251C] outline-none focus:border-[#168447]"
              />
            </div>

            {/* Discrepancy Indicator */}
            {actualCashInput !== '' && (
              <div
                className={`rounded-xl p-3 text-xs font-semibold flex items-center justify-between ${
                  discrepancy === 0
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : discrepancy < 0
                    ? 'bg-red-50 text-red-800 border border-red-200'
                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                }`}
              >
                <span>
                  {discrepancy === 0
                    ? 'Exact Cash Reconciled'
                    : discrepancy < 0
                    ? `Shortage: ₹${Math.abs(discrepancy).toFixed(2)}`
                    : `Excess: ₹${discrepancy.toFixed(2)}`}
                </span>
                <span>
                  {discrepancy === 0 ? '✓ Match' : discrepancy < 0 ? '⚠ Short' : '↑ Over'}
                </span>
              </div>
            )}

            {/* Notes if Discrepancy */}
            {discrepancy !== 0 && actualCashInput !== '' && (
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Discrepancy Explanation Notes
                </label>
                <textarea
                  value={discrepancyNotes}
                  onChange={(e) => setDiscrepancyNotes(e.target.value)}
                  rows={2}
                  placeholder="Explain reason for discrepancy (e.g. customer change shortage, counterfeit bill, etc.)"
                  className="w-full rounded-xl border border-gray-200 p-2 text-xs outline-none focus:border-[#168447]"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || pendingOrders.length === 0 || actualCashInput === ''}
              className="w-full flex items-center justify-center space-x-2 rounded-xl bg-[#168447] py-3 text-xs font-bold text-white shadow-sm hover:bg-[#105C35] disabled:opacity-50 transition"
            >
              <UserCheck className="h-4 w-4" />
              <span>{isSubmitting ? 'Reconciling...' : 'Confirm Cash Deposit & Settle'}</span>
            </button>
          </form>
        </div>

        {/* Pending Orders Breakdown for Selected Rider (2 Columns) */}
        <div className="lg:col-span-2 rounded-2xl border border-[#E0EFE4] bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
                Pending Cash Orders Held by Rider
              </h2>
              <p className="text-xs text-gray-400">
                Delivered orders awaiting final settlement at the store cash register.
              </p>
            </div>
          </div>

          {pendingOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-xs text-gray-400">
              No pending cash collections for this rider. All orders are settled.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 font-semibold uppercase">
                    <th className="pb-3">Order #</th>
                    <th className="pb-3">Customer</th>
                    <th className="pb-3">Delivered At</th>
                    <th className="pb-3 text-right">Cash Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pendingOrders.map((o) => {
                    const addr = o.delivery_address as Record<string, unknown> | null;
                    return (
                      <tr key={o.id} className="hover:bg-gray-50/70">
                        <td className="py-2.5 font-semibold text-[#17251C]">{o.order_number}</td>
                        <td className="py-2.5 text-gray-600">{String(addr?.recipient_name || 'Customer')}</td>
                        <td className="py-2.5 text-gray-400">
                          {o.delivered_at
                            ? new Date(o.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'Delivered'}
                        </td>
                        <td className="py-2.5 text-right font-bold text-[#168447]">
                          ₹{Number(o.total_amount).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Historical Settlements Table */}
          <div className="mt-8 border-t border-gray-100 pt-6">
            <h3 className="text-sm font-bold text-[#17251C] mb-3 flex items-center space-x-1.5">
              <History className="h-4 w-4 text-gray-400" />
              <span>Settlement Audit History</span>
            </h3>

            {settlements.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No past settlements recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 font-semibold uppercase">
                      <th className="pb-2">Reference</th>
                      <th className="pb-2">Rider</th>
                      <th className="pb-2">Orders</th>
                      <th className="pb-2">Expected</th>
                      <th className="pb-2">Received</th>
                      <th className="pb-2">Discrepancy</th>
                      <th className="pb-2">Settled At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {settlements.slice(0, 5).map((s) => {
                      const partner = deliveryPartners.find((dp) => dp.id === s.delivery_partner_id);
                      return (
                        <tr key={s.id} className="hover:bg-gray-50/70">
                          <td className="py-2 font-mono font-bold text-[#17251C]">{s.settlement_reference}</td>
                          <td className="py-2 text-gray-600">{partner?.full_name || 'Partner'}</td>
                          <td className="py-2 text-gray-600">{s.total_orders_settled}</td>
                          <td className="py-2 text-gray-600">₹{Number(s.expected_cash_amount).toFixed(2)}</td>
                          <td className="py-2 font-semibold text-[#168447]">₹{Number(s.actual_cash_received).toFixed(2)}</td>
                          <td className="py-2">
                            <span
                              className={`font-semibold ${
                                Number(s.discrepancy_amount) === 0
                                  ? 'text-gray-400'
                                  : Number(s.discrepancy_amount) < 0
                                  ? 'text-red-600'
                                  : 'text-blue-600'
                              }`}
                            >
                              ₹{Number(s.discrepancy_amount).toFixed(2)}
                            </span>
                          </td>
                          <td className="py-2 text-gray-400">
                            {new Date(s.settled_at).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

