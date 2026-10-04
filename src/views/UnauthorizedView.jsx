import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function UnauthorizedView({ onNavigate }) {
  const { currentUser, logout } = useAuth();

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded shadow-sm overflow-hidden">
        {/* Banner strip */}
        <div className="bg-rose-50 border-b border-rose-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700">
              <span className="material-symbols-outlined text-[24px]">gpp_maybe</span>
            </div>
            <div>
              <h2 className="font-title-md text-[17px] text-rose-950 font-bold">
                Access Restricted: 403 Forbidden
              </h2>
              <p className="text-[12px] text-rose-700 font-label-code">
                Policy: public.fn_is_manager() — Row Level Security Violation Prevention
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded bg-rose-700 text-white font-label-caps text-[10px] uppercase font-bold tracking-wider">
            Manager Required
          </span>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <div>
            <h3 className="text-[15px] font-semibold text-on-surface mb-1">
              Level 3 Administrative Privilege Required
            </h3>
            <p className="text-body-md text-on-surface-variant text-[13px] leading-relaxed">
              The <strong className="text-primary font-semibold">Team & Fleet Management</strong> module contains confidential personnel compensation, fleet vehicle assignments, fuel daily allowances, and driver credential resetting. Field Staff & Driver accounts are restricted from accessing this interface.
            </p>
          </div>

          {/* Current Identity Details Card */}
          <div className="p-4 rounded bg-surface-container-low border border-outline-variant/30">
            <span className="font-label-caps text-[10px] text-secondary uppercase font-bold tracking-wider block mb-2">
              Your Current Authenticated Identity
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[11px] text-outline block">Full Name</span>
                <span className="text-[13px] font-semibold text-on-surface font-title-md">
                  {currentUser?.full_name || 'Staff User'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-outline block">Account Email</span>
                <span className="text-[13px] font-mono text-on-surface">
                  {currentUser?.email || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-outline block">Assigned Role</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-0.5 rounded bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-bold font-label-code">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                  {(currentUser?.role || 'staff').toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Security Architecture Callout */}
          <div className="p-4 rounded bg-surface-container-lowest border border-outline-variant/30 flex items-start gap-3">
            <span className="material-symbols-outlined text-[20px] text-secondary shrink-0 mt-0.5">
              shield_lock
            </span>
            <div className="text-[12px] text-on-surface-variant leading-relaxed">
              <strong className="text-on-surface font-semibold">Database Security Enforcement:</strong> In compliance with PostgreSQL Row Level Security (RLS), <code className="bg-surface-container px-1 py-0.5 rounded text-primary font-mono text-[11px]">auth.uid()</code> is checked against the <code className="bg-surface-container px-1 py-0.5 rounded text-primary font-mono text-[11px]">profiles</code> table and prevents unauthorized access.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-outline-variant/30 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('dashboard')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-on-surface text-[13px] font-medium transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Return to Dashboard
            </button>

            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-container text-on-primary text-[13px] font-medium shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              Sign In with Manager Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
