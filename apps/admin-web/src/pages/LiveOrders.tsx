import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  Package,
  Bike,
  XCircle,
  MapPin,
  Phone,
  User,
  AlertCircle,
  Coins,
  ChevronDown
} from 'lucide-react';
import type { Database, OrderStatus } from '@freshkart/shared';
import { ORDER_STATUS_LABELS } from '@freshkart/shared';

type Order = Database['public']['Tables']['orders']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];

interface LiveOrdersProps {
  orders: Order[];
  deliveryPartners: Profile[];
  orderItems: Record<string, OrderItem[]>;
  onUpdateStatus: (orderId: string, newStatus: OrderStatus, deliveryPartnerId?: string, cancelReason?: string) => Promise<void>;
  isLoading: boolean;
}

export const LiveOrders: React.FC<LiveOrdersProps> = ({
  orders,
  deliveryPartners,
  orderItems,
  onUpdateStatus,
  isLoading,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [assignModalOrder, setAssignModalOrder] = useState<Order | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  // Status Filter options
  const statusTabs: { id: string; label: string }[] = [
    { id: 'ALL', label: 'All Orders' },
    { id: 'PLACED', label: 'New (Placed)' },
    { id: 'CONFIRMED', label: 'Confirmed' },
    { id: 'PACKED', label: 'Packed & Assigned' },
    { id: 'OUT_FOR_DELIVERY', label: 'Dispatched' },
    { id: 'DELIVERED', label: 'Delivered' },
    { id: 'CANCELLED', label: 'Cancelled' },
  ];

  const filteredOrders = orders.filter((o) => {
    if (selectedStatus === 'ALL') return true;
    return o.status === selectedStatus;
  });

  const handleConfirmOrder = async (order: Order) => {
    setIsActionLoading(true);
    try {
      await onUpdateStatus(order.id, 'CONFIRMED');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleOpenAssignModal = (order: Order) => {
    setAssignModalOrder(order);
    setSelectedPartnerId(order.delivery_partner_id || (deliveryPartners[0]?.id ?? ''));
  };

  const handleExecuteAssignAndPack = async () => {
    if (!assignModalOrder || !selectedPartnerId) return;
    setIsActionLoading(true);
    try {
      await onUpdateStatus(assignModalOrder.id, 'PACKED', selectedPartnerId);
      setAssignModalOrder(null);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleOpenCancelModal = (order: Order) => {
    setCancelModalOrder(order);
    setCancelReason('Customer requested cancellation');
  };

  const handleExecuteCancel = async () => {
    if (!cancelModalOrder) return;
    setIsActionLoading(true);
    try {
      await onUpdateStatus(cancelModalOrder.id, 'CANCELLED', undefined, cancelReason);
      setCancelModalOrder(null);
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Status Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#17251C]">Live Order Feed</h1>
          <p className="text-sm text-gray-500">
            Realtime dispatch queue. Review, confirm, and assign riders.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-gray-200 overflow-x-auto pb-1">
        {statusTabs.map((tab) => {
          const count =
            tab.id === 'ALL'
              ? orders.length
              : orders.filter((o) => o.status === tab.id).length;
          const isActive = selectedStatus === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`flex items-center space-x-2 whitespace-nowrap px-4 py-2 text-xs font-semibold rounded-t-xl transition-colors ${
                isActive
                  ? 'border-b-2 border-[#168447] text-[#168447] bg-[#EAF7EE]/50'
                  : 'text-gray-500 hover:text-[#17251C] hover:bg-gray-50'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  isActive ? 'bg-[#168447] text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Orders Grid */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#168447] border-t-transparent" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center text-sm text-gray-400">
          No orders found in this category.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredOrders.map((order) => {
            const items = orderItems[order.id] || [];
            const address = order.delivery_address as Record<string, unknown> | null;
            const assignedPartner = deliveryPartners.find(
              (p) => p.id === order.delivery_partner_id
            );

            return (
              <div
                key={order.id}
                className="flex flex-col justify-between rounded-2xl border border-[#E0EFE4] bg-white p-5 shadow-xs transition hover:shadow-sm"
              >
                {/* Order Top Line */}
                <div>
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div>
                      <span className="text-sm font-black text-[#17251C]">{order.order_number}</span>
                      <p className="text-[11px] text-gray-400">
                        Placed: {new Date(order.placed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        order.status === 'PLACED'
                          ? 'bg-amber-100 text-amber-800 animate-pulse'
                          : order.status === 'CONFIRMED'
                          ? 'bg-blue-100 text-blue-800'
                          : order.status === 'PACKED'
                          ? 'bg-purple-100 text-purple-800'
                          : order.status === 'OUT_FOR_DELIVERY'
                          ? 'bg-indigo-100 text-indigo-800'
                          : order.status === 'DELIVERED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {ORDER_STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>

                  {/* Customer & Address Details */}
                  <div className="mt-3 space-y-1.5 text-xs text-gray-600">
                    <div className="flex items-center space-x-2">
                      <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="font-semibold text-[#17251C]">
                        {String(address?.recipient_name || 'Customer')}
                      </span>
                      <span className="text-gray-400">|</span>
                      <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span>{String(address?.phone || '')}</span>
                    </div>

                    <div className="flex items-start space-x-2">
                      <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">
                        {String(address?.address_line1 || '')}
                        {address?.address_line2 ? `, ${String(address.address_line2)}` : ''}
                        {address?.landmark ? ` (Near: ${String(address.landmark)})` : ''}
                        {address?.distance_km ? ` [${Number(address.distance_km).toFixed(1)} km away]` : ''}
                      </span>
                    </div>

                    {order.customer_notes && (
                      <div className="rounded-lg bg-amber-50/80 p-2 text-amber-800 text-[11px]">
                        <strong>Note:</strong> {order.customer_notes}
                      </div>
                    )}
                  </div>

                  {/* Items Ordered List */}
                  <div className="mt-4 rounded-xl bg-[#F5FAF5] p-3 text-xs">
                    <p className="font-semibold text-gray-500 mb-2 uppercase text-[10px] tracking-wider">
                      Ordered Items ({items.length})
                    </p>
                    {items.length === 0 ? (
                      <p className="text-gray-400 text-xs italic">Loading items...</p>
                    ) : (
                      <ul className="space-y-1">
                        {items.map((it) => (
                          <li key={it.id} className="flex justify-between text-gray-700">
                            <span>
                              {it.quantity}x {it.product_name} ({it.unit})
                            </span>
                            <span className="font-medium">₹{Number(it.total_price).toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-3 border-t border-gray-200 pt-2 flex justify-between font-bold text-sm text-[#17251C]">
                      <span>Total Amount (COD)</span>
                      <span className="text-[#168447]">₹{Number(order.total_amount).toFixed(2)}</span>
                    </div>

                    {/* COD Collection Status Badge */}
                    <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                      <span>Cash Custody:</span>
                      <span
                        className={`font-semibold ${
                          order.cod_status === 'SETTLED_WITH_ADMIN'
                            ? 'text-emerald-700'
                            : order.cod_status === 'HELD_BY_PARTNER'
                            ? 'text-blue-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {order.cod_status === 'SETTLED_WITH_ADMIN'
                          ? 'Settled with Store Register'
                          : order.cod_status === 'HELD_BY_PARTNER'
                          ? 'Held by Rider (Pending Settlement)'
                          : 'Pending Customer Cash Payment'}
                      </span>
                    </div>
                  </div>

                  {/* Assigned Delivery Partner Details */}
                  {assignedPartner && (
                    <div className="mt-3 flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/60 p-2.5 text-xs text-indigo-900">
                      <div className="flex items-center space-x-2">
                        <Bike className="h-4 w-4 text-indigo-600" />
                        <div>
                          <p className="font-bold">Assigned Rider: {assignedPartner.full_name}</p>
                          <p className="text-[11px] text-indigo-600">{assignedPartner.phone_number}</p>
                        </div>
                      </div>
                      {order.status === 'PACKED' && (
                        <button
                          onClick={() => handleOpenAssignModal(order)}
                          className="text-[11px] font-semibold text-indigo-700 underline"
                        >
                          Reassign
                        </button>
                      )}
                    </div>
                  )}

                  {order.cancellation_reason && (
                    <div className="mt-2 text-xs text-red-600 font-medium">
                      Reason: {order.cancellation_reason}
                    </div>
                  )}
                </div>

                {/* State Machine Action Controls */}
                <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                  {order.status === 'PLACED' && (
                    <>
                      <button
                        onClick={() => handleConfirmOrder(order)}
                        disabled={isActionLoading}
                        className="flex-1 inline-flex items-center justify-center space-x-1.5 rounded-xl bg-[#168447] py-2 text-xs font-semibold text-white hover:bg-[#105C35] transition"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Accept & Confirm</span>
                      </button>
                      <button
                        onClick={() => handleOpenCancelModal(order)}
                        disabled={isActionLoading}
                        className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {order.status === 'CONFIRMED' && (
                    <>
                      <button
                        onClick={() => handleOpenAssignModal(order)}
                        disabled={isActionLoading}
                        className="flex-1 inline-flex items-center justify-center space-x-1.5 rounded-xl bg-purple-700 py-2 text-xs font-semibold text-white hover:bg-purple-800 transition"
                      >
                        <Package className="h-4 w-4" />
                        <span>Pack & Assign Rider</span>
                      </button>
                      <button
                        onClick={() => handleOpenCancelModal(order)}
                        disabled={isActionLoading}
                        className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {order.status === 'PACKED' && (
                    <div className="flex-1 flex items-center justify-between text-xs text-gray-500 py-1">
                      <span>Waiting for rider to pick up & dispatch...</span>
                      <button
                        onClick={() => handleOpenCancelModal(order)}
                        disabled={isActionLoading}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Cancel Order
                      </button>
                    </div>
                  )}

                  {order.status === 'OUT_FOR_DELIVERY' && (
                    <div className="flex-1 flex items-center justify-between text-xs text-indigo-700 py-1 font-medium">
                      <span>Rider is on the way to customer...</span>
                      <button
                        onClick={() => handleOpenCancelModal(order)}
                        disabled={isActionLoading}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Mark Failed / Cancel
                      </button>
                    </div>
                  )}

                  {order.status === 'DELIVERED' && (
                    <div className="flex-1 flex items-center justify-between text-xs text-emerald-700 font-semibold py-1">
                      <span className="flex items-center space-x-1">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Delivery Completed</span>
                      </span>
                      <span>₹{Number(order.total_amount).toFixed(2)} Cash Collected</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Assign Delivery Partner */}
      {assignModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[#17251C]">Pack Order & Assign Rider</h3>
            <p className="mt-1 text-xs text-gray-500">
              Assign a verified delivery partner for order{' '}
              <span className="font-semibold text-black">{assignModalOrder.order_number}</span>.
              Riders cannot self-assign; assignment is strictly controlled by store dispatch.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Select Available Delivery Partner
              </label>
              {deliveryPartners.length === 0 ? (
                <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                  No active delivery partners registered. Add delivery partners in the Delivery Partners tab first.
                </div>
              ) : (
                <select
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-[#17251C] outline-none focus:border-[#168447]"
                >
                  {deliveryPartners.map((dp) => (
                    <option key={dp.id} value={dp.id}>
                      {dp.full_name} ({dp.phone_number || 'No Phone'})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => setAssignModalOrder(null)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteAssignAndPack}
                disabled={isActionLoading || !selectedPartnerId}
                className="rounded-xl bg-[#168447] px-4 py-2 text-xs font-semibold text-white hover:bg-[#105C35] disabled:opacity-50"
              >
                {isActionLoading ? 'Assigning...' : 'Confirm Packing & Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cancel Order */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-red-600">Cancel Order</h3>
            <p className="mt-1 text-xs text-gray-500">
              Are you sure you want to cancel {cancelModalOrder.order_number}?
              The database trigger will automatically restock all items back into store inventory.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Cancellation Reason (Required)
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Customer requested, Out of stock, Address unreachable"
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-[#17251C] outline-none focus:border-red-500"
              />
            </div>

            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => setCancelModalOrder(null)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Go Back
              </button>
              <button
                onClick={handleExecuteCancel}
                disabled={isActionLoading || !cancelReason.trim()}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isActionLoading ? 'Cancelling...' : 'Confirm Cancellation & Restock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

