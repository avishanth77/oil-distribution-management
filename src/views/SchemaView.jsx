import React, { useState } from 'react';

export default function SchemaView() {
  const [activeTab, setActiveTab] = useState('tables');

  return (
    <div className="flex flex-col w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between pb-5 border-b border-outline-variant/30 gap-4 mb-6">
        <div>
          <div className="flex items-center gap-1.5 font-label-code text-[11px] text-secondary mb-1">
            <span>CORE ARCHITECTURE</span>
            <span>/</span>
            <span className="text-primary font-semibold">DATABASE DESIGN</span>
          </div>
          <h1 className="font-headline-lg text-2xl lg:text-3xl text-primary tracking-tight font-semibold">
            PostgreSQL Database Schema & Policies
          </h1>
          <p className="font-body-md text-[13px] text-secondary mt-0.5">
            Relational specification deployed via Supabase. Complies with 3NF normalization, append-only financial preservation, and strict RLS.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-low border border-outline-variant/30 font-label-code text-[12px] text-primary font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
          <span>PostgreSQL 15+ / Supabase Active</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {[
          { id: 'tables', label: 'Relational Tables (11)' },
          { id: 'rls', label: 'Row Level Security (RLS) Matrix' },
          { id: 'triggers', label: 'Triggers & Financial Governance' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-on-primary font-semibold shadow-sm'
                : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Tables */}
      {activeTab === 'tables' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: 'public.profiles', badge: 'Core Auth', desc: 'Links to auth.users(id). Carries role (manager | staff) and status flag.', cols: ['id (PK)', 'email', 'full_name', 'role', 'phone', 'is_active'] },
            { name: 'public.distribution_routes', badge: 'Logistics', desc: 'Distribution corridors. Stations and staff assignments attach to these routes.', cols: ['id (PK)', 'route_code (UQ)', 'name', 'description', 'is_active'] },
            { name: 'public.customers', badge: 'Zero-Balance Design', desc: 'Operating customers. No manual balance field. Balances computed dynamically from ledger transactions.', cols: ['id (PK)', 'customer_code (UQ)', 'name', 'gst_number', 'credit_limit', 'is_active'] },
            { name: 'public.fuel_stations', badge: 'Dispensing Point', desc: 'Physical retail and commercial delivery points along routes, owned/operated by customers.', cols: ['id (PK)', 'station_code (UQ)', 'route_id (FK)', 'customer_id (FK)', 'address'] },
            { name: 'public.fuel_deliveries', badge: 'Physical Transactions', desc: 'Delivery records. Stores frozen snapshot of unit_price and computed total_amount.', cols: ['id (PK)', 'delivery_number (UQ)', 'station_id (FK)', 'quantity_liters', 'total_amount'] },
            { name: 'public.customer_advances', badge: 'Approval Workflow', desc: 'Customer advance requests. Supports pending, approved, and rejected states.', cols: ['id (PK)', 'advance_number (UQ)', 'amount', 'status', 'reviewed_by', 'reviewed_at'] },
            { name: 'public.customer_financial_transactions', badge: 'Append-Only Ledger', desc: 'Double-entry financial ledger. Updates and deletions prohibited via trigger.', cols: ['id (PK)', 'transaction_number (UQ)', 'transaction_type', 'entry_type', 'amount'] },
            { name: 'public.staff_route_assignments', badge: 'RLS Access Matrix', desc: 'Maps staff members to routes for corridor-level security isolation.', cols: ['id (PK)', 'staff_id (FK)', 'route_id (FK)', 'assigned_by'] },
            { name: 'public.staff_station_assignments', badge: 'RLS Access Matrix', desc: 'Maps staff members to specific dispensing stations.', cols: ['id (PK)', 'staff_id (FK)', 'station_id (FK)', 'assigned_by'] },
          ].map((t) => (
            <div key={t.name} className="bg-surface-container-lowest border border-outline-variant/30 rounded p-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-label-code text-[12px] font-bold text-primary">{t.name}</span>
                  <span className="font-label-code text-[10px] bg-surface-container-low px-1.5 py-0.5 rounded border border-outline-variant/30 font-semibold text-secondary">
                    {t.badge}
                  </span>
                </div>
                <p className="text-[12px] text-secondary mb-3 leading-relaxed">{t.desc}</p>
              </div>
              <div className="flex flex-wrap gap-1 pt-2 border-t border-outline-variant/20">
                {t.cols.map((c) => (
                  <span key={c} className="font-label-code text-[10px] bg-surface-container px-1 py-0.5 rounded text-primary">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: RLS Matrix */}
      {activeTab === 'rls' && (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded overflow-hidden shadow-sm">
          <div className="p-4 border-b border-outline-variant/20 bg-surface-container-low/40">
            <h3 className="font-title-lg text-[15px] font-bold text-primary">Row Level Security Policy Implementation</h3>
            <p className="text-[12px] text-secondary mt-0.5">Manager bypass policies enabled alongside granular corridor filters for staff personas.</p>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[650px] text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-surface-container-low/70 border-b border-outline-variant/30 font-label-caps text-[11px] text-secondary uppercase">
                  <th className="py-2.5 px-4 font-semibold">Table Target</th>
                  <th className="py-2.5 px-4 font-semibold">Policy Name</th>
                  <th className="py-2.5 px-4 font-semibold">Command</th>
                  <th className="py-2.5 px-4 font-semibold">Manager Rule</th>
                  <th className="py-2.5 px-4 font-semibold">Staff Rule</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 font-label-code text-[12px]">
                <tr>
                  <td className="py-3 px-4 font-bold text-primary">fuel_deliveries</td>
                  <td className="py-3 px-4 text-secondary">staff_scoped_deliveries_select</td>
                  <td className="py-3 px-4 font-semibold text-emerald-700">SELECT</td>
                  <td className="py-3 px-4 text-on-surface">is_manager() = true</td>
                  <td className="py-3 px-4 text-secondary">station_id IN (assigned_stations)</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-primary">customer_advances</td>
                  <td className="py-3 px-4 text-secondary">manager_review_advances_update</td>
                  <td className="py-3 px-4 font-semibold text-amber-800">UPDATE</td>
                  <td className="py-3 px-4 text-on-surface">is_manager() = true</td>
                  <td className="py-3 px-4 text-rose-700 font-semibold">DENIED (Read-only)</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-primary">financial_transactions</td>
                  <td className="py-3 px-4 text-secondary">append_only_ledger_block</td>
                  <td className="py-3 px-4 font-semibold text-rose-700">UPDATE/DELETE</td>
                  <td className="py-3 px-4 text-rose-700 font-semibold">PROHIBITED (Append-only)</td>
                  <td className="py-3 px-4 text-rose-700 font-semibold">PROHIBITED (Append-only)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Triggers */}
      {activeTab === 'triggers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded p-5 shadow-sm">
            <span className="font-label-code text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              PHYSICAL TO FINANCIAL SYNC
            </span>
            <h4 className="font-title-lg text-[15px] font-bold text-primary mt-2 mb-1">
              trg_delivery_to_ledger
            </h4>
            <p className="text-[12px] text-secondary leading-relaxed mb-3">
              Triggered <code>AFTER INSERT ON public.fuel_deliveries</code>. Generates an append-only DEBIT entry in <code>customer_financial_transactions</code> using frozen unit_price snapshot.
            </p>
            <div className="bg-surface-container-low p-2.5 rounded font-label-code text-[11px] text-primary break-all overflow-x-auto">
              INSERT INTO customer_financial_transactions (customer_id, transaction_type, entry_type, amount, ...)
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded p-5 shadow-sm">
            <span className="font-label-code text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              DUAL-CUSTODY APPROVAL
            </span>
            <h4 className="font-title-lg text-[15px] font-bold text-primary mt-2 mb-1">
              trg_advance_approval_to_ledger
            </h4>
            <p className="text-[12px] text-secondary leading-relaxed mb-3">
              Triggered <code>AFTER UPDATE OF status ON public.customer_advances</code>. When status transitions to <code>approved</code>, posts a CREDIT entry into the financial ledger.
            </p>
            <div className="bg-surface-container-low p-2.5 rounded font-label-code text-[11px] text-primary break-all overflow-x-auto">
              IF NEW.status = 'approved' AND OLD.status = 'pending' THEN POST CREDIT;
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
