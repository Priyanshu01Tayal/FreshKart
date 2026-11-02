import React from 'react';
import { Navbar } from './Navbar';
import { Sidebar, NavTab } from './Sidebar';

interface AdminLayoutProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingOrdersCount: number;
  lowStockCount: number;
  isStoreOpen: boolean;
  onToggleStoreOpen: () => void;
  isStoreLoading: boolean;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  activeTab,
  onSelectTab,
  pendingOrdersCount,
  lowStockCount,
  isStoreOpen,
  onToggleStoreOpen,
  isStoreLoading,
  children,
}) => {
  return (
    <div className="min-h-screen bg-[#F5FAF5] text-[#17251C] flex flex-col font-sans">
      <Navbar
        isStoreOpen={isStoreOpen}
        onToggleStoreOpen={onToggleStoreOpen}
        isStoreLoading={isStoreLoading}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          pendingOrdersCount={pendingOrdersCount}
          lowStockCount={lowStockCount}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
};
