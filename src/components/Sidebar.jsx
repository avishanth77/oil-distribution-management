import React from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../lib/dataStore';

export default function Sidebar({ activeTab, setActiveTab, isOpen, onClose }) {
  const { isManager, currentUser, logout } = useAuth();
  const pendingCount = dataStore.advances.filter((a) => a.status === 'pending').length;

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    if (onClose) onClose();
  };

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: 'dashboard',
      badge: null,
      managerOnly: false,
    },
    {
      id: 'deliveries',
      label: 'Deliveries',
      icon: 'local_shipping',
      badge: null,
      managerOnly: false,
    },
    {
      id: 'ledger',
      label: 'Customers',
      icon: 'groups',
      badge: null,
      managerOnly: false,
    },
    {
      id: 'advances',
      label: 'Finance & Advances',
      icon: 'payments',
      badge: pendingCount > 0 ? `${pendingCount}` : null,
      badgeColor: 'bg-amber-600 text-white border-transparent font-bold rounded-full min-w-[18px] h-4 text-center inline-flex items-center justify-center leading-none',
      managerOnly: false,
    },
    {
      id: 'routes',
      label: 'Routes & Stations',
      icon: 'alt_route',
      badge: null,
      managerOnly: false,
    },
    {
      id: 'assignments',
      label: 'Team & Fleet',
      icon: 'manage_accounts',
      badge: isManager ? 'Manager' : 'Locked',
      badgeColor: isManager ? 'bg-primary-container/10 text-primary border-primary/20' : 'bg-rose-50 text-rose-700 border-rose-200',
      managerOnly: true,
    },
    {
      id: 'schema',
      label: 'System Architecture',
      icon: 'database',
      badge: 'Postgres',
      badgeColor: 'bg-sky-50 text-sky-800 border-sky-200',
      managerOnly: false,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-[#00141f]/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-64 bg-surface-container-lowest border-r border-outline-variant/30 z-50 flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Logo Brand Header */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-outline-variant/20">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-amber-400 shrink-0">
                <span className="material-symbols-outlined text-[20px]">local_gas_station</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-headline-sm text-[16px] text-primary font-bold tracking-tight">
                  PETRO<span className="text-secondary font-normal">FLOW</span>
                </span>
                <span className="font-label-code text-[9px] text-secondary tracking-widest uppercase">
                  TEXOL LOGISTICS ERP
                </span>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1 text-secondary hover:text-primary rounded"
              aria-label="Close navigation drawer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Section: Modules */}
          <div className="px-4 pt-5 pb-2">
            <span className="font-label-caps text-[11px] text-outline uppercase tracking-wider font-semibold">
              Operational Modules
            </span>
          </div>

          {/* Nav list */}
          <nav className="flex flex-col px-1.5 space-y-0.5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const isLockedForStaff = item.managerOnly && !isManager;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectTab(item.id)}
                  className={`flex items-center justify-between px-3 py-2 text-body-md font-body-md transition-colors border-l-2 text-left cursor-pointer ${
                    isActive
                      ? 'border-primary text-primary font-semibold bg-surface-container-low'
                      : isLockedForStaff
                      ? 'border-transparent text-outline/80 hover:text-on-surface hover:bg-surface-container-low/60'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                  }`}
                  title={isLockedForStaff ? 'Manager role required (Click to view authorization info)' : undefined}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`material-symbols-outlined text-[18px] shrink-0 ${
                        isActive ? 'text-primary' : isLockedForStaff ? 'text-outline/70' : 'text-secondary'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isLockedForStaff && (
                      <span className="material-symbols-outlined text-[14px] text-rose-500">lock</span>
                    )}
                    {item.badge && (
                      <span
                        className={`font-label-code text-[10px] px-1.5 py-0.2 rounded border font-semibold ${
                          item.badgeColor || 'bg-surface-container-low text-secondary'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Profile & RLS Strip + Sign Out */}
        <div className="p-3 border-t border-outline-variant/20 bg-surface-container-lowest">
          <div className="flex items-start justify-between mb-2">
            <div className="flex flex-col min-w-0">
              <span className="font-title-md text-[13px] text-on-surface font-semibold truncate">
                {currentUser?.full_name || 'Active User'}
              </span>
              <span className="font-label-caps text-[10px] text-secondary uppercase mt-0.5 truncate">
                {isManager ? 'Operations Director' : 'Corridor Field Officer'}
              </span>
            </div>
            <span
              className={`font-label-code text-[10px] px-1.5 py-0.5 rounded border font-semibold ${
                isManager
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-amber-800 bg-amber-50 border-amber-200'
              }`}
            >
              {isManager ? 'Manager' : 'Staff'}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-outline-variant/15 text-[11px]">
            <span className="text-secondary font-label-code flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              RLS Active
            </span>
            <button
              type="button"
              onClick={logout}
              className="text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Sign out of active session"
            >
              <span className="material-symbols-outlined text-[14px]">logout</span>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
