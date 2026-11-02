import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  TrendingUp,
  Package,
  CheckCircle,
  XCircle,
  BarChart3
} from 'lucide-react';
import type { Database } from '@freshkart/shared';

type Order = Database['public']['Tables']['orders']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];

interface SalesReportsProps {
  orders: Order[];
  products: Product[];
  orderItems: Record<string, OrderItem[]>;
  isLoading: boolean;
}

export const SalesReports: React.FC<SalesReportsProps> = ({
  orders,
  products,
  orderItems,
  isLoading,
}) => {
  const [timeframe, setTimeframe] = useState<'today' | '7days' | '30days' | 'all'>('7days');

  // Filter orders by timeframe
  const now = new Date();
  const filteredOrders = orders.filter((o) => {
    const orderDate = new Date(o.placed_at);
    if (timeframe === 'today') {
      return orderDate.toDateString() === now.toDateString();
    }
    if (timeframe === '7days') {
      const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
      return diffDays <= 7;
    }
    if (timeframe === '30days') {
      const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
      return diffDays <= 30;
    }
    return true;
  });

  const validOrders = filteredOrders.filter((o) => o.status !== 'CANCELLED');
  const deliveredOrders = filteredOrders.filter((o) => o.status === 'DELIVERED');
  const cancelledOrders = filteredOrders.filter((o) => o.status === 'CANCELLED');

  const grossSales = validOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const totalDeliveryFees = validOrders.reduce((sum, o) => sum + Number(o.delivery_fee), 0);
  const netProductSales = validOrders.reduce((sum, o) => sum + Number(o.subtotal), 0);
  const avgOrderValue = validOrders.length > 0 ? grossSales / validOrders.length : 0;

  // Aggregate Top Selling Products
  const productStats: Record<string, { name: string; quantity: number; revenue: number }> = {};
  filteredOrders.forEach((o) => {
    if (o.status === 'CANCELLED') return;
    const items = orderItems[o.id] || [];
    items.forEach((it) => {
      if (!productStats[it.product_name]) {
        productStats[it.product_name] = { name: it.product_name, quantity: 0, revenue: 0 };
      }
      productStats[it.product_name].quantity += it.quantity;
      productStats[it.product_name].revenue += Number(it.total_price);
    });
  });

  const topProducts = Object.values(productStats)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const exportCsv = () => {
    const headers = ['Order Number', 'Date', 'Status', 'Subtotal', 'Delivery Fee', 'Total Amount', 'COD Status'];
    const rows = filteredOrders.map((o) => [
      o.order_number,
      new Date(o.placed_at).toISOString(),
      o.status,
      Number(o.subtotal).toFixed(2),
      Number(o.delivery_fee).toFixed(2),
      Number(o.total_amount).toFixed(2),
      o.cod_status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `freshkart_sales_report_${timeframe}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Title & Timeframe Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#17251C]">Sales & Financial Reports</h1>
          <p className="text-sm text-gray-500">
            Realtime revenue analytics, order status distribution, and top grocery demand.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="inline-flex rounded-xl bg-gray-100 p-1 text-xs font-semibold">
            <button
              onClick={() => setTimeframe('today')}
              className={`rounded-lg px-3 py-1.5 transition ${
                timeframe === 'today' ? 'bg-white text-[#168447] shadow-xs' : 'text-gray-500 hover:text-black'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeframe('7days')}
              className={`rounded-lg px-3 py-1.5 transition ${
                timeframe === '7days' ? 'bg-white text-[#168447] shadow-xs' : 'text-gray-500 hover:text-black'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setTimeframe('30days')}
              className={`rounded-lg px-3 py-1.5 transition ${
                timeframe === '30days' ? 'bg-white text-[#168447] shadow-xs' : 'text-gray-500 hover:text-black'
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setTimeframe('all')}
              className={`rounded-lg px-3 py-1.5 transition ${
                timeframe === 'all' ? 'bg-white text-[#168447] shadow-xs' : 'text-gray-500 hover:text-black'
              }`}
            >
              All Time
            </button>
          </div>

          <button
            onClick={exportCsv}
            className="inline-flex items-center space-x-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#17251C] hover:bg-gray-50 shadow-xs"
          >
            <Download className="h-4 w-4 text-gray-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#D5EEDB] bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Gross Sales</span>
          <p className="mt-2 text-2xl font-extrabold text-[#168447]">
            ₹{grossSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-gray-400">Total pipeline + delivered value</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Orders</span>
          <p className="mt-2 text-2xl font-extrabold text-[#17251C]">{filteredOrders.length}</p>
          <p className="mt-1 text-xs text-emerald-700 font-medium">
            {deliveredOrders.length} Delivered ({cancelledOrders.length} Cancelled)
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Average Order Value</span>
          <p className="mt-2 text-2xl font-extrabold text-[#17251C]">
            ₹{avgOrderValue.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-gray-400">Per valid placed order</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Delivery Fees Earned</span>
          <p className="mt-2 text-2xl font-extrabold text-[#17251C]">
            ₹{totalDeliveryFees.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-gray-400">From orders below free threshold</p>
        </div>
      </div>

      {/* Two Columns: Top Selling Grocery Items & Fulfillment Health */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Products */}
        <div className="rounded-2xl border border-[#E0EFE4] bg-white p-6 shadow-xs">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="h-4 w-4 text-[#168447]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#17251C]">
              Top Revenue Products
            </h2>
          </div>

          {topProducts.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-8 text-center">No sales data for this timeframe.</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, idx) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between rounded-xl border border-gray-100 p-3 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center space-x-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EAF7EE] text-xs font-bold text-[#168447]">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-[#17251C]">{p.name}</p>
                      <p className="text-[11px] text-gray-500">{p.quantity} units sold</p>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-[#168447]">
                    ₹{p.revenue.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order Status Breakdown */}
        <div className="rounded-2xl border border-[#E0EFE4] bg-white p-6 shadow-xs">
          <div className="flex items-center space-x-2 mb-4">
            <BarChart3 className="h-4 w-4 text-[#168447]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#17251C]">
              Order Fulfillment Distribution
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            {['PLACED', 'CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].map((st) => {
              const count = filteredOrders.filter((o) => o.status === st).length;
              const percentage = filteredOrders.length > 0 ? (count / filteredOrders.length) * 100 : 0;

              return (
                <div key={st} className="space-y-1">
                  <div className="flex justify-between font-semibold text-gray-700">
                    <span>{st}</span>
                    <span>
                      {count} ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        st === 'DELIVERED'
                          ? 'bg-emerald-600'
                          : st === 'CANCELLED'
                          ? 'bg-red-500'
                          : 'bg-[#168447]'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
