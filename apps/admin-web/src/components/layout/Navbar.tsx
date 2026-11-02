import React, { useState } from 'react';
import {
  Store,
  Volume2,
  VolumeX,
  LogOut,
  User,
  ShoppingBag,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { orderChime } from '../../utils/audio';

interface NavbarProps {
  isStoreOpen: boolean;
  onToggleStoreOpen: () => void;
  isStoreLoading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  isStoreOpen,
  onToggleStoreOpen,
  isStoreLoading,
}) => {
  const { profile, signOut, isDevMode } = useAuth();
  const [isMuted, setIsMuted] = useState<boolean>(orderChime.getMuted());

  const handleToggleMute = () => {
    const newMuted = orderChime.toggleMute();
    setIsMuted(newMuted);
    if (!newMuted) {
      orderChime.playNewOrderChime();
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#E0EFE4] bg-white px-4 shadow-sm sm:px-6">
      {/* Brand & Store Quick Status */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#168447] text-white shadow-sm">
          <ShoppingBag className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold tracking-tight text-[#17251C]">FreshKart</span>
            <span className="rounded-full bg-[#EAF7EE] px-2 py-0.5 text-xs font-semibold text-[#168447]">
              Operations Hub
            </span>
            {isDevMode && (
              <span className="hidden items-center space-x-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 sm:inline-flex">
                <AlertCircle className="h-3 w-3" />
                <span>Local Sandbox</span>
              </span>
            )}
          </div>
          <p className="hidden text-xs text-gray-500 sm:block">Koramangala Dark Store #1</p>
        </div>
      </div>

      {/* Action Controls & Admin Profile */}
      <div className="flex items-center space-x-2 sm:space-x-4">
        {/* Store Open / Closed Switch */}
        <button
          onClick={onToggleStoreOpen}
          disabled={isStoreLoading}
          className={`flex items-center space-x-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
            isStoreOpen
              ? 'border-emerald-200 bg-[#EAF7EE] text-[#168447] hover:bg-emerald-100'
              : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
          }`}
          title={isStoreOpen ? 'Store is open for orders. Click to close.' : 'Store is closed. Click to open.'}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isStoreOpen ? 'animate-pulse bg-[#168447]' : 'bg-red-500'
            }`}
          />
          <Store className="h-3.5 w-3.5" />
          <span>{isStoreLoading ? 'Updating...' : isStoreOpen ? 'Store: OPEN' : 'Store: CLOSED'}</span>
        </button>

        {/* Audio Chime Mute/Unmute */}
        <button
          onClick={handleToggleMute}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
            isMuted
              ? 'border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100'
              : 'border-[#C4E3CC] bg-[#EAF7EE] text-[#168447] hover:bg-[#D5EEDB]'
          }`}
          title={isMuted ? 'Order audio alerts muted (click to unmute)' : 'Order audio alerts active (click to test/mute)'}
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>

        <div className="h-6 w-px bg-gray-200" />

        {/* Admin User Info */}
        <div className="flex items-center space-x-3">
          <div className="hidden text-right md:block">
            <p className="text-xs font-semibold text-[#17251C]">{profile?.full_name || 'Admin'}</p>
            <p className="text-[11px] text-gray-500">{profile?.phone_number || 'Master Store Mgr'}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#105C35] text-white">
            <User className="h-4 w-4" />
          </div>
          <button
            onClick={() => signOut()}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
