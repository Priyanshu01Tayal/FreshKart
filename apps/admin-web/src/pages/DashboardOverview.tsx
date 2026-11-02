import React from 'react';
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  AlertTriangle,
  Coins,
  ChevronRight,
  PackageX
} from 'lucide-react';
import type { Database } from '@freshkart/shared';
import { ORDER_STATUS_LABELS } from '@freshkart/shared';

type Order = Database['public']['Tables']['orders']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

interface DashboardOverviewProps {
  orders: Order[];
  products: Product[];
  isLoading: boolean;
  onNavigateToOrders: () => void;
  onNavigateToInventory: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  orders,
  products,
  isLoading,
  onNavigateToOrders,
  onNavigateToInventory,
}) => {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#168447] border-t-transparent" />
      </div>
    );
  }

  // Calculate real metrics from live database
  const todayStr = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter((o) => o.placed_at.startsWith(todayStr));

  const todayGrossSales = todayOrders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + Number(o.total_amount), 0);

  const activeOrdersCount = orders.filter(
    (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
  ).length;

  const outOfStockProducts = products.filter(
    (p) => p.is_active && p.stock_quantity === 0
  );

  const lowStockProducts = products.filter(
    (p) => p.is_active && p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold
  );

  const cashHeldByRiders = orders
    .filter((o) => o.status === 'DELIVERED' && o.cod_status === 'HELD_BY_PARTNER')
    .reduce((sum, o) => sum + Number(o.total_amount), 0);

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#17251C]">Operations Dashboard</h1>
        <p className="text-sm text-gray-500">Live summary of dark store orders, sales, and stock health.</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Metric 1: Today's Revenue */}
        <div className="rounded-2xl border border-[#D5EEDB] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Today's Sales</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF7EE] text-[#168447]">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-[#17251C]">
            ₹{todayGrossSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-gray-500">{todayOrders.length} orders placed today</p>
        </div>

        {/* Metric 2: Active Pipeline */}
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Active Orders</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-[#17251C]">{activeOrdersCount}</p>
          <p className="mt-1 text-xs text-amber-700 font-medium">In processing & delivery</p>
        </div>

        {/* Metric 3: Cash in Transit */}
        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Cash in Transit</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Coins className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-[#17251C]">
            ₹{cashHeldByRiders.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-blue-700 font-medium">Held by delivery riders</p>
        </div>

        {/* Metric 4: Low Stock Warnings */}
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Low Stock Items</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-[#17251C]">{lowStockProducts.length}</p>
          <p className="mt-1 text-xs text-gray-500">Below safety thresholds</p>
        </div>

        {/* Metric 5: Out of Stock */}
        <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Out of Stock</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <PackageX className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-red-600">{outOfStockProducts.length}</p>
          <p className="mt-1 text-xs text-red-700 font-medium">Action required</p>
        </div>
      </div>

      {/* Two Column Layout: Recent Orders & Stock Alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Orders Table (2 Columns wide) */}
        <div className="lg:col-span-2 rounded-2xl border border-[#E0EFE4] bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-[#17251C]">Recent Live Orders</h2>
              <p className="text-xs text-gray-500">Latest orders entering the fulfillment pipeline</p>
            </div>
            <button
              onClick={onNavigateToOrders}
              className="inline-flex items-center space-x-1 text-xs font-semibold text-[#168447] hover:text-[#105C35]"
            >
              <span>View All Orders</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              No orders placed yet. Orders will appear here live.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 font-semibold uppercase">
                    <th className="pb-3">Order Number</th>
                    <th className="pb-3">Items</th>
                    <th className="pb-3">Total (COD)</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 font-semibold text-[#17251C]">{o.order_number}</td>
                      <td className="py-3 text-gray-600">
                        ₹{Number(o.subtotal).toFixed(2)} + ₹{Number(o.delivery_fee).toFixed(0)} fee
                      </td>
                      <td className="py-3 font-bold text-[#168447]">₹{Number(o.total_amount).toFixed(2)}</td>
                      <td className="py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            o.status === 'PLACED'
                              ? 'bg-amber-100 text-amber-800'
                              : o.status === 'CONFIRMED'
                              ? 'bg-blue-100 text-blue-800'
                              : o.status === 'PACKED'
                              ? 'bg-purple-100 text-purple-800'
                              : o.status === 'OUT_FOR_DELIVERY'
                              ? 'bg-indigo-100 text-indigo-800'
                              : o.status === 'DELIVERED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {ORDER_STATUS_LABELS[o.status] || o.status}
                        </span>
                      </td>
                      <td className="py-3 text-gray-400">
                        {new Date(o.placed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Critical Stock Alerts Panel (1 Column wide) */}
        <div className="rounded-2xl border border-[#E0EFE4] bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-[#17251C]">Low Stock Alerts</h2>
                <p className="text-xs text-gray-500">Items that need urgent restock</p>
              </div>
              <button
                onClick={onNavigateToInventory}
                className="text-xs font-semibold text-[#168447] hover:text-[#105C35]"
              >
                Manage
              </button>
            </div>

            {lowStockProducts.length === 0 && outOfStockProducts.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">
                All inventory levels are healthy.
              </div>
            ) : (
              <div className="space-y-3">
                {[...outOfStockProducts, ...lowStockProducts].slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-gray-100 p-2.5 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center space-x-3">
                      <img
                        src={p.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100'}
                        alt={p.name}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                      <div>
                        <p className="text-xs font-semibold text-[#17251C] line-clamp-1">{p.name}</p>
                        <p className="text-[11px] text-gray-500">{p.unit}</p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        p.stock_quantity === 0
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {p.stock_quantity === 0 ? 'Out of stock' : `${p.stock_quantity} left`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onNavigateToInventory}
            className="mt-4 w-full rounded-xl border border-[#D5EEDB] bg-[#EAF7EE] py-2.5 text-xs font-semibold text-[#168447] hover:bg-[#C4E3CC] transition"
          >
            Open Inventory Desk
          </button>
        </div>
      </div>
    </div>
  );
};
