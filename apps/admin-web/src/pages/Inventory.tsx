import React, { useState } from 'react';
import { AlertTriangle, PackageX, CheckCircle, Search, RefreshCw } from 'lucide-react';
import type { Database } from '@freshkart/shared';

type Product = Database['public']['Tables']['products']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

interface InventoryProps {
  products: Product[];
  categories: Category[];
  onUpdateStock: (productId: string, newStock: number) => Promise<void>;
  isLoading: boolean;
}

export const Inventory: React.FC<InventoryProps> = ({
  products,
  categories,
  onUpdateStock,
  isLoading,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'OUT' | 'LOW' | 'HEALTHY'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filter === 'OUT') return p.stock_quantity === 0;
    if (filter === 'LOW') return p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold;
    if (filter === 'HEALTHY') return p.stock_quantity > p.low_stock_threshold;
    return true;
  });

  const handleAddStock = async (p: Product, addQty: number) => {
    setUpdatingId(p.id);
    try {
      await onUpdateStock(p.id, p.stock_quantity + addQty);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSetExactStock = async (p: Product, val: string) => {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed < 0) return;
    setUpdatingId(p.id);
    try {
      await onUpdateStock(p.id, parsed);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#17251C]">Inventory & Stock Alerts</h1>
        <p className="text-sm text-gray-500">
          Monitor safety thresholds and instantly replenish dark store inventory.
        </p>
      </div>

      {/* Filter Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <button
          onClick={() => setFilter('ALL')}
          className={`rounded-2xl border p-4 text-left transition ${
            filter === 'ALL'
              ? 'border-[#168447] bg-[#EAF7EE] shadow-xs'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <span className="text-xs font-semibold uppercase text-gray-500">All Products</span>
          <p className="mt-1 text-2xl font-extrabold text-[#17251C]">{products.length}</p>
        </button>

        <button
          onClick={() => setFilter('OUT')}
          className={`rounded-2xl border p-4 text-left transition ${
            filter === 'OUT'
              ? 'border-red-500 bg-red-50 shadow-xs'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-red-700">Out of Stock</span>
            <PackageX className="h-4 w-4 text-red-500" />
          </div>
          <p className="mt-1 text-2xl font-extrabold text-red-700">
            {products.filter((p) => p.stock_quantity === 0).length}
          </p>
        </button>

        <button
          onClick={() => setFilter('LOW')}
          className={`rounded-2xl border p-4 text-left transition ${
            filter === 'LOW'
              ? 'border-amber-500 bg-amber-50 shadow-xs'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-amber-700">Low Stock</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-1 text-2xl font-extrabold text-amber-700">
            {products.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold).length}
          </p>
        </button>

        <button
          onClick={() => setFilter('HEALTHY')}
          className={`rounded-2xl border p-4 text-left transition ${
            filter === 'HEALTHY'
              ? 'border-emerald-500 bg-emerald-50 shadow-xs'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-emerald-700">Healthy Stock</span>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">
            {products.filter((p) => p.stock_quantity > p.low_stock_threshold).length}
          </p>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 h-4 w-4 mt-3" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter inventory by product name..."
          className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-xs text-[#17251C] outline-none focus:border-[#168447]"
        />
      </div>

      {/* Inventory Table */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#168447] border-t-transparent" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center text-sm text-gray-400">
          No inventory items match the current filter.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E0EFE4] bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-gray-100 bg-gray-50/50 text-gray-400 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Item & Unit</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Current Stock</th>
                  <th className="py-3 px-4">Threshold</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Quick Restock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((p) => {
                  const cat = categories.find((c) => c.id === p.category_id);
                  const isLow = p.stock_quantity <= p.low_stock_threshold && p.stock_quantity > 0;
                  const isOut = p.stock_quantity === 0;

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <img
                            src={p.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100'}
                            alt={p.name}
                            className="h-10 w-10 rounded-lg object-cover border border-gray-100"
                          />
                          <div>
                            <p className="font-semibold text-[#17251C]">{p.name}</p>
                            <p className="text-[11px] text-gray-400">{p.unit}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{cat?.name || 'Uncategorized'}</td>
                      <td className="py-3 px-4 font-bold">
                        <input
                          type="number"
                          min="0"
                          defaultValue={p.stock_quantity}
                          key={p.stock_quantity}
                          onBlur={(e) => handleSetExactStock(p, e.target.value)}
                          className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-center font-bold text-xs focus:border-[#168447] outline-none"
                        />
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-mono">{p.low_stock_threshold} units</td>
                      <td className="py-3 px-4">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isOut
                              ? 'bg-red-100 text-red-800'
                              : isLow
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'Optimal'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => handleAddStock(p, 10)}
                            disabled={updatingId === p.id}
                            className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-[#EAF7EE] hover:text-[#168447] transition"
                          >
                            +10
                          </button>
                          <button
                            onClick={() => handleAddStock(p, 25)}
                            disabled={updatingId === p.id}
                            className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-[#EAF7EE] hover:text-[#168447] transition"
                          >
                            +25
                          </button>
                          <button
                            onClick={() => handleAddStock(p, 50)}
                            disabled={updatingId === p.id}
                            className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-[#EAF7EE] hover:text-[#168447] transition"
                          >
                            +50
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

