import React, { useState, useEffect } from 'react';
import {
  Store,
  Bike,
  Compass,
  DollarSign,
  Phone,
  MapPin,
  CheckCircle,
  AlertCircle,
  Save
} from 'lucide-react';
import type { Database } from '@freshkart/shared';

type StoreSettings = Database['public']['Tables']['store_settings']['Row'];

interface StoreControlsProps {
  settings: StoreSettings | null;
  onUpdateSettings: (updates: Partial<StoreSettings>) => Promise<void>;
  isLoading: boolean;
}

export const StoreControls: React.FC<StoreControlsProps> = ({
  settings,
  onUpdateSettings,
  isLoading,
}) => {
  const [formData, setFormData] = useState({
    store_name: '',
    store_address: '',
    latitude: '12.9345330',
    longitude: '77.6265790',
    delivery_radius_km: '5.00',
    is_store_open: true,
    is_delivery_available: true,
    min_order_value: '99.00',
    standard_delivery_fee: '25.00',
    free_delivery_threshold: '299.00',
    contact_phone: '+919876543210',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setFormData({
        store_name: settings.store_name,
        store_address: settings.store_address,
        latitude: String(settings.latitude),
        longitude: String(settings.longitude),
        delivery_radius_km: String(settings.delivery_radius_km),
        is_store_open: settings.is_store_open,
        is_delivery_available: settings.is_delivery_available,
        min_order_value: String(settings.min_order_value),
        standard_delivery_fee: String(settings.standard_delivery_fee),
        free_delivery_threshold: String(settings.free_delivery_threshold),
        contact_phone: settings.contact_phone,
      });
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaveSuccess(false);

    const radius = parseFloat(formData.delivery_radius_km);
    const minOrder = parseFloat(formData.min_order_value);
    const fee = parseFloat(formData.standard_delivery_fee);
    const freeThresh = parseFloat(formData.free_delivery_threshold);

    if (isNaN(radius) || radius <= 0) {
      setError('Delivery radius must be a positive number in kilometers.');
      return;
    }
    if (isNaN(minOrder) || minOrder < 0) {
      setError('Minimum order value must be zero or a positive amount.');
      return;
    }
    if (isNaN(fee) || fee < 0) {
      setError('Delivery fee must be zero or a positive amount.');
      return;
    }
    if (isNaN(freeThresh) || freeThresh < minOrder) {
      setError('Free delivery threshold cannot be lower than the minimum order value.');
      return;
    }

    setIsSaving(true);
    try {
      await onUpdateSettings({
        store_name: formData.store_name.trim(),
        store_address: formData.store_address.trim(),
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        delivery_radius_km: radius,
        is_store_open: formData.is_store_open,
        is_delivery_available: formData.is_delivery_available,
        min_order_value: minOrder,
        standard_delivery_fee: fee,
        free_delivery_threshold: freeThresh,
        contact_phone: formData.contact_phone.trim(),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update store settings';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !settings) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#168447] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#17251C]">Store & Dispatch Settings</h1>
        <p className="text-sm text-gray-500">
          Configure operating hours, delivery zone radius, and minimum order checkout rules.
        </p>
      </div>

      {saveSuccess && (
        <div className="flex items-center space-x-2 rounded-2xl bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 border border-emerald-200">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>Store dispatch configuration successfully saved and updated across all clients!</span>
        </div>
      )}

      {error && (
        <div className="flex items-start space-x-2 rounded-2xl bg-red-50 p-4 text-xs text-red-700 border border-red-200">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Master Toggles: Store Status & Delivery Availability */}
        <div className="rounded-2xl border border-[#E0EFE4] bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
            Realtime Operational Switches
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Store Open / Closed Toggle */}
            <div
              className={`flex items-center justify-between rounded-xl border p-4 transition ${
                formData.is_store_open
                  ? 'border-emerald-200 bg-[#EAF7EE]/50'
                  : 'border-red-200 bg-red-50/50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Store
                  className={`h-5 w-5 ${
                    formData.is_store_open ? 'text-[#168447]' : 'text-red-600'
                  }`}
                />
                <div>
                  <p className="text-xs font-bold text-[#17251C]">Store Status</p>
                  <p className="text-[11px] text-gray-500">
                    {formData.is_store_open
                      ? 'Accepting live customer orders'
                      : 'Store closed; customer ordering paused'}
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.is_store_open}
                onChange={(e) => setFormData({ ...formData, is_store_open: e.target.checked })}
                className="h-5 w-5 rounded text-[#168447] focus:ring-[#168447]"
              />
            </div>

            {/* Delivery Availability Toggle */}
            <div
              className={`flex items-center justify-between rounded-xl border p-4 transition ${
                formData.is_delivery_available
                  ? 'border-blue-200 bg-blue-50/50'
                  : 'border-amber-200 bg-amber-50/50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Bike
                  className={`h-5 w-5 ${
                    formData.is_delivery_available ? 'text-blue-600' : 'text-amber-600'
                  }`}
                />
                <div>
                  <p className="text-xs font-bold text-[#17251C]">Delivery Partner Service</p>
                  <p className="text-[11px] text-gray-500">
                    {formData.is_delivery_available
                      ? 'Riders active and delivering'
                      : 'Delivery temporarily halted (e.g. rain/shortage)'}
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.is_delivery_available}
                onChange={(e) => setFormData({ ...formData, is_delivery_available: e.target.checked })}
                className="h-5 w-5 rounded text-blue-600 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Pricing, Checkout Rules & Service Radius */}
        <div className="rounded-2xl border border-[#E0EFE4] bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
            Checkout Limits & Delivery Pricing
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Minimum Order Value (₹)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={formData.min_order_value}
                onChange={(e) => setFormData({ ...formData, min_order_value: e.target.value })}
                required
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-[#17251C] outline-none focus:border-[#168447]"
              />
              <p className="mt-1 text-[11px] text-gray-400">Cart subtotal must exceed this to checkout.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Standard Delivery Fee (₹)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={formData.standard_delivery_fee}
                onChange={(e) => setFormData({ ...formData, standard_delivery_fee: e.target.value })}
                required
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-[#17251C] outline-none focus:border-[#168447]"
              />
              <p className="mt-1 text-[11px] text-gray-400">Flat fee charged on orders below threshold.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Free Delivery Above (₹)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={formData.free_delivery_threshold}
                onChange={(e) => setFormData({ ...formData, free_delivery_threshold: e.target.value })}
                required
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-[#17251C] outline-none focus:border-[#168447]"
              />
              <p className="mt-1 text-[11px] text-gray-400">Orders exceeding this amount receive free delivery.</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Operational Delivery Radius (Kilometers)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="25"
                value={formData.delivery_radius_km}
                onChange={(e) => setFormData({ ...formData, delivery_radius_km: e.target.value })}
                required
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-[#17251C] outline-none focus:border-[#168447]"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Customers outside this radius are blocked at checkout by the atomic RPC.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Store Dispatch Phone Number
              </label>
              <input
                type="text"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                required
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-[#17251C] outline-none focus:border-[#168447]"
              />
              <p className="mt-1 text-[11px] text-gray-400">For rider communications and support.</p>
            </div>
          </div>
        </div>

        {/* Hub Location Coordinates */}
        <div className="rounded-2xl border border-[#E0EFE4] bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
            Dark Store Physical Location (Hub Coordinates)
          </h2>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Store Address</label>
            <input
              type="text"
              value={formData.store_address}
              onChange={(e) => setFormData({ ...formData, store_address: e.target.value })}
              required
              className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-[#17251C] outline-none focus:border-[#168447]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Hub Latitude</label>
              <input
                type="text"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                required
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-mono text-[#17251C] outline-none focus:border-[#168447]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Hub Longitude</label>
              <input
                type="text"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                required
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-mono text-[#17251C] outline-none focus:border-[#168447]"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center space-x-2 rounded-xl bg-[#168447] px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#105C35] disabled:opacity-50 transition"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Updating Store...' : 'Save All Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

