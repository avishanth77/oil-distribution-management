import React from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../lib/dataStore';
import { isSupabaseConfigured } from '../lib/supabase';

export default function Navbar({ onToggleSidebar }) {
  const { currentUser, isManager, triggerRefresh, logout } = useAuth();
  const pendingAdvancesCount = dataStore.advances.filter((a) => a.status === 'pending').length;

  const initials = currentUser?.full_name
    ? currentUser.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-md border-b border-outline-variant/30 z-40 px-3 sm:px-5 lg:px-6 flex items-center justify-between transition-all duration-200">
      {/* Left: Hamburger menu (mobile/tablet) & Operational Info */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Toggle Button */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 -ml-1 text-primary hover:bg-surface-container-low rounded transition-colors flex items-center justify-center shrink-0"
          aria-label="Toggle navigation drawer"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        {/* Operational Period (Tablet & Desktop) */}
        <div className="hidden md:flex items-center gap-2 text-on-surface-variant font-label-code text-[12px] lg:text-[13px] shrink-0">
          <span className="w-2 h-2 rounded-full bg-secondary"></span>
          <span className="text-on-surface font-semibold">September 2026</span>
          <span className="text-outline">·</span>
          <span>All Corridors</span>
        </div>

        {/* Realtime DB status */}
        {isSupabaseConfigured ? (
          <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-label-code text-[10px] sm:text-[11px] truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse shrink-0"></span>
            <span className="hidden sm:inline">Supabase Live ({dataStore.customers.length} CUST · {dataStore.deliveries.length} DLV)</span>
            <span className="sm:hidden font-semibold">Live DB</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-label-code text-[10px] sm:text-[11px] truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0"></span>
            <span className="hidden sm:inline">Offline Local Cache</span>
            <span className="sm:hidden font-semibold">Offline</span>
          </div>
        )}
      </div>

      {/* Right: Actions, Notifications, User Identity & Sign Out */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Sync Trigger */}
        <button
          onClick={triggerRefresh}
          className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-on-surface text-[12px] font-medium transition-colors"
          title="Sync with Supabase"
          type="button"
        >
          <span className={`material-symbols-outlined text-[16px] text-secondary ${dataStore.isLoading ? 'animate-spin' : ''}`}>
            sync
          </span>
          <span className="hidden sm:inline">{dataStore.isLoading ? 'Syncing...' : 'Sync'}</span>
        </button>

        {/* Notifications */}
        {pendingAdvancesCount > 0 ? (
          <div
            className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-300 font-label-code text-[11px] shadow-2xs"
            title={`${pendingAdvancesCount} advances pending approval`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping shrink-0"></span>
            <span className="material-symbols-outlined text-[15px] sm:text-[16px] text-amber-800">notifications</span>
            <span className="hidden md:inline font-medium">Pending:</span>
            <span className="bg-amber-600 text-white rounded-full text-[10px] font-bold px-1.5 min-w-[16px] h-4 inline-flex items-center justify-center leading-none">
              {pendingAdvancesCount}
            </span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-code text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            <span>All Clear</span>
          </div>
        )}

        {/* Authenticated User Identity Display (Role locked to login session) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 pl-2 sm:pl-3 border-l border-outline-variant/30">
          <div className="flex flex-col items-end min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-bold text-on-surface truncate max-w-[110px] sm:max-w-[160px]">
                {currentUser?.full_name || 'Authenticated User'}
              </span>
              <span
                className={`font-label-caps text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border ${
                  isManager
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}
              >
                {isManager ? 'Manager' : 'Staff'}
              </span>
            </div>

            {/* Fixed user email identifier - No role switching permitted */}
            <span className="text-[10px] text-secondary font-mono truncate max-w-[120px] sm:max-w-[160px]">
              {currentUser?.email || (isManager ? 'manager@texol.com' : 'driver@texol.com')}
            </span>
          </div>

          {/* User Avatar */}
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[12px] shrink-0 border ${
              isManager
                ? 'bg-primary text-on-primary border-primary/20'
                : 'bg-amber-600 text-white border-amber-700/20'
            }`}
            title={`Logged in as ${currentUser?.full_name} (${currentUser?.role})`}
          >
            {initials}
          </div>

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={logout}
            className="ml-1 p-1.5 text-secondary hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center justify-center"
            title="Sign Out of PetroFlow"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
