import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { dataStore } from '../lib/dataStore';
import Modal from '../components/Modal';

export default function DashboardView({ onNavigate }) {
  const { currentUser, isManager, triggerRefresh } = useAuth();
  const { error: toastError } = useToast();
  const filteredData = dataStore.getFilteredData(currentUser);
  const financialSummaries = dataStore.getCustomerFinancialSummaries();

  const [selectedAdvance, setSelectedAdvance] = useState(null);
  const [actionType, setActionType] = useState('approve');
  const [actionNotes, setActionNotes] = useState('');
  const [timeRange, setTimeRange] = useState('30D');

  // Calculations
  const totalLiters = filteredData.deliveries.reduce((sum, d) => sum + Number(d.quantity_liters || 0), 0);
  const totalFuelBilled = filteredData.deliveries.reduce((sum, d) => sum + Number(d.total_amount || 0), 0);
  
  const approvedAdvancesTotal = filteredData.advances
    .filter((a) => a.status === 'approved')
    .reduce((sum, a) => sum + Number(a.amount || 0), 0);

  const pendingAdvances = filteredData.advances.filter((a) => a.status === 'pending');

  const visibleCustomerIds = filteredData.customers.map((c) => c.id);
  const totalOutstandingBalance = financialSummaries
    .filter((s) => visibleCustomerIds.includes(s.customer_id))
    .reduce((sum, s) => sum + s.current_outstanding_balance, 0);

  // True metric values reflecting current ledger and deliveries
  const displayGrossSales = `₹${Math.round(totalFuelBilled).toLocaleString('en-IN')}`;
  const displayFuelDistributed = `${Math.round(totalLiters).toLocaleString('en-IN')} L`;
  const displayOutstanding = `₹${Math.round(totalOutstandingBalance).toLocaleString('en-IN')}`;
  const displayAdvances = `₹${Math.round(approvedAdvancesTotal).toLocaleString('en-IN')}`;

  const handleOpenAction = (advance, type) => {
    setSelectedAdvance(advance);
    setActionType(type);
    setActionNotes('');
  };

  const handleConfirmAction = async () => {
    if (!selectedAdvance) return;
    try {
      if (actionType === 'approve') {
        await dataStore.approveAdvance(selectedAdvance.id, actionNotes, currentUser);
      } else {
        await dataStore.rejectAdvance(selectedAdvance.id, actionNotes, currentUser);
      }
      setSelectedAdvance(null);
      triggerRefresh();
    } catch (err) {
      toastError('Failed to process advance: ' + err.message);
    }
  };

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* 1. Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between pb-5 border-b border-outline-variant/30 gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-label-caps text-[11px] uppercase text-secondary tracking-widest font-semibold">
              Downstream Distribution Ops
            </span>
            <span className="text-outline text-body-sm">/</span>
            <span className="font-label-code text-[12px] text-on-surface-variant font-medium">
              Live Console
            </span>
          </div>
          <h1 className="font-headline-xl text-2xl sm:text-3xl font-semibold text-primary tracking-tight">
            Operations Overview
          </h1>
          <p className="font-body-md text-[12px] sm:text-[13px] text-on-surface-variant mt-0.5 sm:mt-1">
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} <span className="text-outline mx-1">·</span> {filteredData.stations.length > 0 ? `${filteredData.stations.length} Active Station${filteredData.stations.length > 1 ? 's' : ''}` : 'All Distribution Points'}
          </p>
        </div>

        {/* Quick Action Bar */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button 
            type="button" 
            onClick={() => onNavigate('deliveries')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary hover:bg-primary-container transition-colors rounded text-body-sm font-medium border border-primary shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>New Delivery</span>
          </button>
          <button 
            type="button" 
            onClick={() => onNavigate('advances')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low transition-colors rounded text-body-sm font-medium border border-outline-variant/40"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">payments</span>
            <span>Customer Payment</span>
          </button>
          <button 
            type="button" 
            onClick={() => onNavigate('advances')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low transition-colors rounded text-body-sm font-medium border border-outline-variant/40"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">request_quote</span>
            <span>Advance Request</span>
          </button>
          <button 
            type="button" 
            onClick={() => onNavigate('schema')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low transition-colors rounded text-body-sm font-medium border border-outline-variant/40"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">database</span>
            <span>Schema</span>
          </button>
        </div>
      </div>

      {/* 2. Performance Summary (Continuous Horizontal Metric Ledger) */}
      <section className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x lg:divide-x divide-outline-variant/30">
          {/* Metric 1 */}
          <div className="p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-secondary mb-1.5 sm:mb-2">
              <span className="font-label-caps text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold">Gross Sales (MTD)</span>
              <span className="font-label-code text-[10px] sm:text-[11px] text-outline font-semibold">INR</span>
            </div>
            <div className="font-metric-display text-xl sm:text-2xl lg:text-[26px] font-semibold text-primary tabular-nums tracking-tight">
              {displayGrossSales}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 sm:mt-2 font-label-code text-[11px] text-secondary font-medium">
              {totalFuelBilled > 0 ? (
                <>
                  <span className="material-symbols-outlined text-[14px] text-emerald-700">trending_up</span>
                  <span className="text-emerald-700 font-semibold">Live invoiced dispatches</span>
                </>
              ) : (
                <span>No sales records yet</span>
              )}
            </div>
          </div>

          {/* Metric 2 */}
          <div className="p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-secondary mb-1.5 sm:mb-2">
              <span className="font-label-caps text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold">Fuel Distributed</span>
              <span className="font-label-code text-[10px] sm:text-[11px] text-outline font-semibold">VOLUME</span>
            </div>
            <div className="font-metric-display text-xl sm:text-2xl lg:text-[26px] font-semibold text-primary tabular-nums tracking-tight">
              {displayFuelDistributed}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 sm:mt-2 font-label-code text-[11px] text-secondary font-medium">
              {totalLiters > 0 ? (
                <>
                  <span className="material-symbols-outlined text-[14px] text-emerald-700">arrow_upward</span>
                  <span className="text-emerald-700 font-semibold">Accumulated volume</span>
                </>
              ) : (
                <span>0 L dispatched</span>
              )}
            </div>
          </div>

          {/* Metric 3: Outstanding Balance */}
          <div className="p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-secondary mb-1.5 sm:mb-2">
              <span className="font-label-caps text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold">Outstanding Balance</span>
              <span className="font-label-code text-[10px] sm:text-[11px] text-outline font-semibold">RECEIVABLE</span>
            </div>
            <div className="font-metric-display text-xl sm:text-2xl lg:text-[26px] font-semibold text-primary tabular-nums tracking-tight">
              {displayOutstanding}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 sm:mt-2 font-label-code text-[11px] text-amber-800 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span>Live ledger derived</span>
            </div>
          </div>

          {/* Metric 4: Customer Advances */}
          <div className="p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-secondary mb-1.5 sm:mb-2">
              <span className="font-label-caps text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold">Customer Advances</span>
              <span className="font-label-code text-[10px] sm:text-[11px] text-outline font-semibold">ESCROW</span>
            </div>
            <div className="font-metric-display text-xl sm:text-2xl lg:text-[26px] font-semibold text-primary tabular-nums tracking-tight">
              {displayAdvances}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 sm:mt-2 font-label-code text-[11px] text-secondary font-medium">
              <span className="material-symbols-outlined text-[14px]">schedule</span>
              <span>{pendingAdvances.length} pending review</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Main Analytics & Distribution Section (Two-Column Mechanical Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Sales Off-take Vector (7 cols) */}
        <section className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant/30 rounded flex flex-col justify-between shadow-sm">
          <div className="p-5 border-b border-outline-variant/20 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-label-caps text-[11px] uppercase text-secondary font-semibold">Terminal Dispatch Analytics</span>
              <h2 className="font-headline-sm text-lg text-primary font-semibold">Sales Performance</h2>
            </div>
            {/* Time Range Picker */}
            <div className="inline-flex p-0.5 rounded bg-surface-container-low border border-outline-variant/30">
              {['7D', '30D', '90D', '1Y'].map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTimeRange(range)}
                  className={`px-2.5 py-1 text-[11px] font-label-code transition-colors rounded-sm ${
                    timeRange === range
                      ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          {/* Minimal Chart Section / Empty State */}
          <div className="p-4 sm:p-5 flex-1 flex flex-col justify-center">
            {filteredData.deliveries.length > 0 ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1.5 mb-4">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-body-sm font-label-code text-secondary text-[11px] sm:text-[12px]">
                    <span>Total Dispatches: {filteredData.deliveries.length}</span>
                    <span className="text-outline hidden sm:inline">|</span>
                    <span>Total Invoiced: {displayGrossSales}</span>
                  </div>
                  <span className="font-label-code text-[10px] sm:text-[11px] text-outline">Values in INR (₹)</span>
                </div>
                
                <div className="relative w-full h-48 sm:h-56">
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 700 200">
                    <line className="text-outline-variant/30" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="700" y1="20" y2="20"></line>
                    <line className="text-outline-variant/30" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="700" y1="70" y2="70"></line>
                    <line className="text-outline-variant/30" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="700" y1="120" y2="120"></line>
                    <line className="text-outline-variant/40" stroke="currentColor" strokeWidth="1" x1="0" x2="700" y1="170" y2="170"></line>
                    <polyline
                      fill="none"
                      points={filteredData.deliveries.slice(0, 10).map((d, i, arr) => {
                        const x = Math.round((i / Math.max(1, arr.length - 1)) * 680) + 10;
                        const maxAmt = Math.max(...arr.map((item) => Number(item.total_amount || 1)), 1);
                        const y = Math.round(160 - ((Number(d.total_amount || 0) / maxAmt) * 130));
                        return `${x},${y}`;
                      }).join(' ')}
                      stroke="#00141f"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </>
            ) : (
              <div className="relative w-full h-48 sm:h-56 flex flex-col items-center justify-center border border-dashed border-outline-variant/40 rounded bg-surface-container-low/20">
                <span className="material-symbols-outlined text-[36px] text-outline mb-2">query_stats</span>
                <p className="font-body-md text-sm text-secondary font-medium">No sales records yet</p>
                <p className="font-label-code text-[11px] text-outline mt-0.5">Record a delivery to begin plotting dispatch analytics</p>
              </div>
            )}
          </div>

          {/* Contextual Footer Strip */}
          <div className="px-4 sm:px-5 py-2.5 bg-surface-container-low/60 border-t border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-body-sm font-label-code text-[11px] sm:text-[12px]">
            <span className="text-on-surface-variant">Daily Run Rate: <strong className="text-primary font-semibold">{totalFuelBilled > 0 ? `₹${Math.round(totalFuelBilled / 30).toLocaleString('en-IN')}` : '₹0'}</strong></span>
            <span className="text-secondary">{filteredData.deliveries.length > 0 ? `${filteredData.deliveries.length} logged dispatches` : 'No dispatch activity logged yet'}</span>
          </div>
        </section>

        {/* Right Column: Top Clients (5 cols) */}
        <section className="lg:col-span-5 bg-surface-container-lowest border border-outline-variant/30 rounded flex flex-col justify-between shadow-sm">
          <div>
            <div className="px-5 pt-4 pb-3 border-b border-outline-variant/20 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-label-caps text-[11px] uppercase text-secondary font-semibold">B2B Standing</span>
                <h2 className="font-title-lg text-title-lg text-primary font-semibold">Top Commercial Customers</h2>
              </div>
              <span className="font-label-code text-[11px] text-outline font-semibold">MTD Invoicing</span>
            </div>
            <div className="divide-y divide-outline-variant/20">
              {filteredData.customers.length > 0 ? (
                filteredData.customers.slice(0, 5).map((c, idx) => {
                  const summary = financialSummaries.find((s) => s.customer_id === c.id);
                  const bal = summary ? summary.current_outstanding_balance : 0;
                  return (
                    <div key={c.id || idx} className="px-5 py-2.5 flex items-center justify-between hover:bg-surface-container-low/40 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-label-code text-[11px] text-outline font-semibold w-4">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="font-body-md text-[13px] font-medium text-primary truncate">
                            {c.name}
                          </span>
                          <span className="font-label-code text-[11px] text-secondary">
                            {c.company_name || 'Active Consignee'}
                          </span>
                        </div>
                      </div>
                      <span className="font-label-code text-[13px] font-semibold text-primary tabular-nums ml-2">
                        ₹{Number(bal).toLocaleString('en-IN')}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center flex flex-col items-center justify-center">
                  <span className="material-symbols-outlined text-[32px] text-outline mb-2">person_off</span>
                  <p className="font-body-md text-sm text-secondary font-medium">No customers yet</p>
                  <p className="font-label-code text-[11px] text-outline mt-0.5">Register customers in the Ledger to track accounts</p>
                </div>
              )}
            </div>
          </div>
          <div className="px-5 py-2.5 bg-surface-container-low/60 border-t border-outline-variant/20 flex items-center justify-between text-body-sm font-label-code text-[11px]">
            <span className="text-secondary">Tracked Accounts ({filteredData.customers.length})</span>
            <button
              type="button"
              onClick={() => onNavigate('ledger')}
              className="text-primary hover:underline font-semibold flex items-center gap-1"
            >
              <span>View All Customers</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </section>
      </div>

      {/* 4. Recent Deliveries High-Density Ledger */}
      <section className="bg-surface-container-lowest border border-outline-variant/30 rounded flex flex-col shadow-sm">
        <div className="px-5 py-3.5 border-b border-outline-variant/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-headline-sm text-lg text-primary font-semibold">Recent Deliveries</h2>
            <span className="font-label-code text-[11px] text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/30 font-semibold">
              {filteredData.deliveries.length} logged dispatches
            </span>
          </div>
          <button 
            type="button" 
            onClick={() => onNavigate('deliveries')}
            className="inline-flex items-center gap-1 font-body-sm text-[12px] text-primary hover:text-primary-container font-semibold transition-colors"
          >
            <span>View all deliveries</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-surface-container-low/50 border-b border-outline-variant/30 font-label-caps text-[11px] text-secondary uppercase tracking-wider">
                <th className="py-2.5 px-4 sm:px-5 font-semibold">Delivery No.</th>
                <th className="py-2.5 px-3 sm:px-4 font-semibold">Customer / Station</th>
                <th className="py-2.5 px-3 sm:px-4 font-semibold">Product</th>
                <th className="py-2.5 px-3 sm:px-4 text-right font-semibold">Quantity</th>
                <th className="py-2.5 px-3 sm:px-4 text-right font-semibold">Unit Price</th>
                <th className="py-2.5 px-3 sm:px-4 text-right font-semibold">Total Amount</th>
                <th className="py-2.5 px-3 sm:px-4 text-center font-semibold">Status</th>
                <th className="py-2.5 px-4 sm:px-5 text-right font-semibold">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 font-body-md text-[12px] sm:text-[13px]">
              {filteredData.deliveries.length > 0 ? (
                filteredData.deliveries.slice(0, 5).map((del) => {
                  const station = filteredData.stations.find((s) => s.id === del.station_id);
                  const product = filteredData.products.find((p) => p.id === del.fuel_product_id);
                  const isDelivered = (del.status || '').toLowerCase() === 'delivered';
                  const isTransit = (del.status || '').toLowerCase().includes('transit');

                  return (
                    <tr key={del.id} className="hover:bg-surface-container-low/30 transition-colors">
                      <td className="py-2.5 sm:py-3 px-4 sm:px-5 font-label-code text-[11px] sm:text-[12px] font-semibold text-primary">
                        {del.delivery_number}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4">
                        <div className="font-medium text-on-surface">
                          {del.customer_name || (station ? station.name : 'Commercial Consignee')}
                        </div>
                        {del.driver_name && (
                          <div className="text-[10px] sm:text-[11px] text-secondary font-label-code">
                            {del.driver_name} {del.truck_plate_number ? `(${del.truck_plate_number})` : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-on-surface-variant font-medium text-[12px] sm:text-[13px]">
                        {product ? product.name : (del.product_name || 'Fuel Product')}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-right font-label-code tabular-nums text-on-surface text-[12px] sm:text-[13px]">
                        {Number(del.quantity_liters).toLocaleString()} L
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-right font-label-code tabular-nums text-secondary text-[11px] sm:text-[12px]">
                        ₹{Number(del.unit_price || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-right font-label-code font-semibold tabular-nums text-primary text-[12px] sm:text-[13px]">
                        ₹{Number(del.total_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold border ${
                          isDelivered 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                            : isTransit 
                            ? 'bg-sky-50 text-sky-800 border-sky-200' 
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {del.status || 'Delivered'}
                        </span>
                      </td>
                      <td className="py-2.5 sm:py-3 px-4 sm:px-5 text-right font-label-code text-[10px] sm:text-[11px] text-outline whitespace-nowrap">
                        {del.date || (del.delivery_date ? new Date(del.delivery_date).toLocaleDateString() : '—')}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <span className="material-symbols-outlined text-[36px] text-outline mb-2">local_shipping</span>
                      <p className="font-title-md text-[14px] text-primary font-semibold">No sales records yet</p>
                      <p className="font-label-code text-[11px] text-outline mt-0.5">Logged dispatches will appear here in chronological order</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination / Status Footer */}
        <div className="px-4 sm:px-5 py-2.5 border-t border-outline-variant/20 bg-surface-container-low/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-body-sm font-label-code text-secondary text-[11px] sm:text-[12px]">
          <div>
            Showing {filteredData.deliveries.length > 0 ? `1 – ${Math.min(5, filteredData.deliveries.length)}` : '0'} of {filteredData.deliveries.length} logged dispatches
          </div>
          <div className="flex items-center gap-1 self-end sm:self-auto">
            <button className="px-2.5 py-1 border border-outline-variant/30 rounded bg-surface-container-lowest text-outline cursor-not-allowed text-[11px]" type="button" disabled>
              Prev
            </button>
            <button 
              className="px-2.5 py-1 border border-outline-variant/30 rounded bg-surface-container-lowest text-primary hover:bg-surface-container transition-colors text-[11px]" 
              type="button"
              onClick={() => onNavigate('deliveries')}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* Decision Modal for Manager Action */}
      <Modal
        isOpen={Boolean(selectedAdvance)}
        onClose={() => setSelectedAdvance(null)}
        title={actionType === 'approve' ? 'Approve Customer Advance' : 'Reject Customer Advance'}
      >
        {selectedAdvance && (
          <div className="space-y-4">
            <div className="p-3 bg-surface-container-low border border-outline-variant/30 rounded flex justify-between">
              <div>
                <span className="text-[11px] font-label-caps uppercase text-secondary">Advance Ref</span>
                <div className="font-label-code font-semibold text-primary">{selectedAdvance.advance_number}</div>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-label-caps uppercase text-secondary">Requested Amount</span>
                <div className="font-label-code font-semibold text-emerald-700">₹{Number(selectedAdvance.amount).toLocaleString('en-IN')}</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Manager Audit Notes</label>
              <textarea
                className="form-textarea w-full text-body-md"
                placeholder="Enter remarks, authorization token, or justification..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedAdvance(null)}>
                Cancel
              </button>
              <button
                className={`btn btn-sm ${actionType === 'approve' ? 'btn-success' : 'btn-danger'}`}
                onClick={handleConfirmAction}
              >
                {actionType === 'approve' ? 'Authorize & Post Ledger' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
