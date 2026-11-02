import React from 'react';
import {
  LayoutDashboard,
  Clock,
  Package,
  Layers,
  SlidersHorizontal,
  Bike,
  Coins,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';

export type NavTab =
  | 'orders'
  | 'dashboard'
  | 'products'
  | 'inventory'
  | 'categories'
  | 'delivery'
  | 'reconciliation'
  | 'store-settings'
  | 'reports';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingOrdersCount: number;
  lowStockCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  pendingOrdersCount,
  lowStockCount,
}) => {
  const navItems = [
    {
      id: 'orders' as NavTab,
      label: 'Live Orders',
      icon: Clock,
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : null,
      badgeColor: 'bg-amber-500 text-white animate-pulse',
    },
    {
      id: 'dashboard' as NavTab,
      label: 'Sales Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'inventory' as NavTab,
      label: 'Inventory & Alerts',
      icon: AlertTriangle,
      badge: lowStockCount > 0 ? lowStockCount : null,
      badgeColor: 'bg-red-500 text-white',
    },
    {
      id: 'products' as NavTab,
      label: 'Products Catalog',
      icon: Package,
    },
    {
      id: 'categories' as NavTab,
      label: 'Categories',
      icon: Layers,
    },
    {
      id: 'delivery' as NavTab,
      label: 'Delivery Partners',
      icon: Bike,
    },
    {
      id: 'reconciliation' as NavTab,
      label: 'COD Reconciliation',
      icon: Coins,
    },
    {
      id: 'store-settings' as NavTab,
      label: 'Store & Dispatch',
      icon: SlidersHorizontal,
    },
    {
      id: 'reports' as NavTab,
      label: 'Sales Reports',
      icon: FileSpreadsheet,
    },
  ];

  return (
    <aside className="flex flex-col w-64 border-r border-[#E0EFE4] bg-white p-3 h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="mb-2 px-3 pt-2 text-[11px] font-bold tracking-wider text-gray-400 uppercase">
        Store Operations
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#EAF7EE] text-[#168447] font-semibold shadow-xs'
                  : 'text-[#17251C] hover:bg-gray-50 hover:text-[#105C35]'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon
                  className={`h-4.5 w-4.5 ${
                    isActive ? 'text-[#168447]' : 'text-gray-400'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold leading-none ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick operational tip footer */}
      <div className="mt-auto rounded-xl border border-emerald-100 bg-[#EAF7EE]/60 p-3 text-xs text-[#105C35]">
        <p className="font-semibold">Quick Commerce Rule:</p>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-600">
          Orders are auto-assigned to delivery partners strictly by store admins. Self-assignment by riders is disabled.
        </p>
      </div>
    </aside>
  );
};

