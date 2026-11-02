import React, { useState } from 'react';
import { Bike, UserPlus, Phone, CheckCircle2, XCircle, Coins, AlertCircle } from 'lucide-react';
import type { Database } from '@freshkart/shared';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Order = Database['public']['Tables']['orders']['Row'];

interface DeliveryPartnersProps {
  deliveryPartners: Profile[];
  orders: Order[];
  onToggleActive: (partnerId: string, isActive: boolean) => Promise<void>;
  onAddPartner: (fullName: string, phone: string) => Promise<void>;
  isLoading: boolean;
}

export const DeliveryPartners: React.FC<DeliveryPartnersProps> = ({
  deliveryPartners,
  orders,
  onToggleActive,
  onAddPartner,
  isLoading,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) {
      setError('Please provide full name and phone number.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onAddPartner(fullName.trim(), phone.trim());
      setFullName('');
      setPhone('');
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register partner';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#17251C]">Delivery Fleet Partners</h1>
          <p className="text-sm text-gray-500">
            Manage authorized store riders, dispatch assignments, and held cash custody.
          </p>
        </div>
        <button
          onClick={() => {
            setModalOpen(true);
            setError(null);
          }}
          className="inline-flex items-center space-x-2 rounded-xl bg-[#168447] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#105C35] transition"
        >
          <UserPlus className="h-4 w-4" />
          <span>Add Delivery Partner</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#168447] border-t-transparent" />
        </div>
      ) : deliveryPartners.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center text-sm text-gray-400">
          No delivery partners registered yet. Add a delivery partner above to start assigning orders.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {deliveryPartners.map((dp) => {
            // Count active deliveries for this partner
            const activeDeliveries = orders.filter(
              (o) =>
                o.delivery_partner_id === dp.id &&
                (o.status === 'PACKED' || o.status === 'OUT_FOR_DELIVERY')
            ).length;

            // Calculate pending cash held by this rider
            const cashHeld = orders
              .filter(
                (o) =>
                  o.delivery_partner_id === dp.id &&
                  o.status === 'DELIVERED' &&
                  o.cod_status === 'HELD_BY_PARTNER'
              )
              .reduce((sum, o) => sum + Number(o.total_amount), 0);

            return (
              <div
                key={dp.id}
                className="flex flex-col justify-between rounded-2xl border border-[#E0EFE4] bg-white p-5 shadow-xs hover:shadow-sm transition"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF7EE] text-[#168447]">
                        <Bike className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#17251C]">{dp.full_name}</p>
                        <p className="text-xs text-gray-500 flex items-center space-x-1 mt-0.5">
                          <Phone className="h-3 w-3" />
                          <span>{dp.phone_number || 'No phone recorded'}</span>
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        dp.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {dp.is_active ? 'Active' : 'On Leave'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[#F5FAF5] p-3 text-xs">
                    <div>
                      <span className="text-gray-400 font-semibold uppercase text-[10px]">Active Orders</span>
                      <p className="text-base font-bold text-[#17251C] mt-0.5">
                        {activeDeliveries} {activeDeliveries === 1 ? 'order' : 'orders'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-400 font-semibold uppercase text-[10px]">Cash In Hand</span>
                      <p className="text-base font-bold text-blue-700 mt-0.5">
                        ₹{cashHeld.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                  <span className="text-xs text-gray-400">
                    Role: <span className="font-semibold text-gray-600">Rider Partner</span>
                  </span>
                  <button
                    onClick={() => onToggleActive(dp.id, !dp.is_active)}
                    className={`text-xs font-semibold hover:underline ${
                      dp.is_active ? 'text-amber-600' : 'text-emerald-600'
                    }`}
                  >
                    {dp.is_active ? 'Mark as Inactive' : 'Activate Rider'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add Delivery Partner */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[#17251C]">Add Delivery Fleet Partner</h3>
            <p className="mt-1 text-xs text-gray-500">
              Register an official rider to dispatch customer orders from this dark store.
            </p>

            {error && (
              <div className="mt-4 flex items-start space-x-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAdd} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  required
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-[#17251C] outline-none focus:border-[#168447]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919876543210"
                  required
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-[#17251C] outline-none focus:border-[#168447]"
                />
              </div>

              <div className="mt-6 flex justify-end space-x-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#168447] px-5 py-2 font-semibold text-white hover:bg-[#105C35] disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering...' : 'Register Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
