import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { dataStore } from '../lib/dataStore';
import { validateUpload, readFileAsDataUrl } from '../lib/uploadValidation';
import Modal from '../components/Modal';

export default function AdvancesView() {
  const { currentUser, isManager, triggerRefresh } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();
  const filteredData = dataStore.getFilteredData(currentUser);

  // Tabs: 'advances' | 'expenses'
  const [activeFinanceTab, setActiveFinanceTab] = useState('advances');
  const [statusFilter, setStatusFilter] = useState('all');

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  // Review Modal (Manager only)
  const [reviewAdvance, setReviewAdvance] = useState(null);
  const [reviewAction, setReviewAction] = useState('approve');
  const [reviewNotes, setReviewNotes] = useState('');

  // Form: Customer Advance Request
  const [requestData, setRequestData] = useState({
    customer_id: filteredData.customers[0]?.id || '',
    station_id: filteredData.stations[0]?.id || '',
    amount: '',
    payment_method: 'bank_transfer',
    reference_document: '',
    request_notes: '',
  });

  // Form: Everyday Expense (Food, Toll, Vehicle maintenance, Daily allowance)
  const [expenseForm, setExpenseForm] = useState({
    category: 'Food & Meals',
    amount: '',
    station_id: filteredData.stations[0]?.id || '',
    notes: '',
    receipt_filename: '',
    receipt_url: '',
    date: new Date().toISOString().slice(0, 10),
  });

  const handleOpenReview = (adv, action) => {
    if (!isManager) {
      toastError('Access Denied: Only Operations Managers can confirm and approve customer advances.');
      return;
    }
    setReviewAdvance(adv);
    setReviewAction(action);
    setReviewNotes('');
  };

  const handleConfirmReview = async () => {
    if (!isManager) return;
    if (!reviewAdvance) return;
    try {
      if (reviewAction === 'approve') {
        await dataStore.approveAdvance(reviewAdvance.id, reviewNotes, currentUser);
        toastSuccess(`Advance confirmed by Manager! The amount of ₹${Number(reviewAdvance.amount).toLocaleString('en-IN')} has now been credited to the customer's database ledger balance.`);
      } else {
        await dataStore.rejectAdvance(reviewAdvance.id, reviewNotes, currentUser);
        toastSuccess('Advance request rejected. Customer balance remains unaffected.');
      }
      setReviewAdvance(null);
      triggerRefresh();
    } catch (err) {
      toastError('Failed to update advance: ' + err.message);
    }
  };

  const handleCreateAdvanceRequest = async (e) => {
    e.preventDefault();
    if (!requestData.customer_id || !requestData.amount || Number(requestData.amount) <= 0) {
      toastError('Please select a customer and specify a valid advance amount.');
      return;
    }

    try {
      await dataStore.requestAdvance(requestData, currentUser);
      setIsRequestModalOpen(false);
      setRequestData({
        customer_id: filteredData.customers[0]?.id || '',
        station_id: filteredData.stations[0]?.id || '',
        amount: '',
        payment_method: 'bank_transfer',
        reference_document: '',
        request_notes: '',
      });
      triggerRefresh();
      toastSuccess('Customer advance request recorded as PENDING. It will be added to the customer database ledger once confirmed by the Operations Manager.');
    } catch (err) {
      toastError('Failed to submit advance: ' + err.message);
    }
  };

  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const check = validateUpload(file);
    if (!check.ok) {
      toastError(check.error);
      e.target.value = '';
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setExpenseForm((prev) => ({
        ...prev,
        receipt_filename: file.name,
        receipt_url: dataUrl,
      }));
    } catch (err) {
      toastError(err.message);
    }
    e.target.value = '';
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) {
      toastError('Please specify an expense amount.');
      return;
    }

    try {
      await dataStore.recordEverydayExpense(expenseForm, currentUser);
      setIsExpenseModalOpen(false);
      setExpenseForm({
        category: 'Food & Meals',
        amount: '',
        station_id: filteredData.stations[0]?.id || '',
        notes: '',
        receipt_filename: '',
        receipt_url: '',
        date: new Date().toISOString().slice(0, 10),
      });
      triggerRefresh();
      toastSuccess('Everyday expense logged successfully!');
    } catch (err) {
      toastError('Failed to log expense: ' + err.message);
    }
  };

  const displayedAdvances = filteredData.advances.filter((adv) => {
    if (statusFilter === 'all') return true;
    return adv.status === statusFilter;
  });

  const pendingCount = filteredData.advances.filter((a) => a.status === 'pending').length;
  const approvedTotal = filteredData.advances.filter((a) => a.status === 'approved').reduce((sum, a) => sum + Number(a.amount || 0), 0);
  const totalExpenses = dataStore.everydayExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return (
    <div className="flex flex-col w-full">
      {/* Title & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between pb-5 border-b border-outline-variant/30 gap-4 mb-6">
        <div>
          <div className="flex items-center gap-1.5 font-label-code text-[11px] text-secondary mb-1">
            <span>FINANCE & TREASURY</span>
            <span>/</span>
            <span className="text-primary font-semibold">
              {activeFinanceTab === 'advances' ? 'CUSTOMER ADVANCES' : 'EVERYDAY OPERATIONAL EXPENSES'}
            </span>
          </div>
          <h1 className="font-headline-lg text-2xl lg:text-3xl text-primary tracking-tight font-semibold">
            {activeFinanceTab === 'advances' ? 'Customer Advances & Governance' : 'Everyday Operational Expenses'}
          </h1>
          <p className="font-body-md text-[13px] text-secondary mt-0.5">
            {activeFinanceTab === 'advances'
              ? 'Advance amounts paid by customers are credited to the database ledger only after confirmation from the manager.'
              : 'Log daily food allowances, highway tolls, vehicle maintenance, and petty cash with attached receipts.'}
          </p>
        </div>

        {/* Tab & Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-0.5 rounded bg-surface-container-low border border-outline-variant/30">
            <button
              type="button"
              onClick={() => setActiveFinanceTab('advances')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-[12px] font-medium rounded-sm transition-colors inline-flex items-center gap-1.5 ${
                activeFinanceTab === 'advances'
                  ? 'bg-primary text-on-primary font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>Customer Advances</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-label-code font-bold min-w-[16px] h-4 inline-flex items-center justify-center leading-none ${
                activeFinanceTab === 'advances' ? 'bg-surface-container-lowest/25 text-white' : 'bg-surface-container-high text-secondary'
              }`}>
                {filteredData.advances.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFinanceTab('expenses')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-[12px] font-medium rounded-sm transition-colors inline-flex items-center gap-1.5 ${
                activeFinanceTab === 'expenses'
                  ? 'bg-primary text-on-primary font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>Daily Expenses</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-label-code font-bold min-w-[16px] h-4 inline-flex items-center justify-center leading-none ${
                activeFinanceTab === 'expenses' ? 'bg-surface-container-lowest/25 text-white' : 'bg-surface-container-high text-secondary'
              }`}>
                {dataStore.everydayExpenses.length}
              </span>
            </button>
          </div>

          {activeFinanceTab === 'advances' ? (
            <button
              type="button"
              onClick={() => setIsRequestModalOpen(true)}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 bg-primary text-on-primary rounded text-[11px] sm:text-[12px] md:text-[13px] font-semibold shadow-sm hover:bg-primary-container shrink-0"
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[16px]">add</span>
              <span>+ Record Customer Advance</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsExpenseModalOpen(true)}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 bg-primary text-on-primary rounded text-[11px] sm:text-[12px] md:text-[13px] font-semibold shadow-sm hover:bg-primary-container shrink-0"
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[16px]">receipt</span>
              <span>+ Add Everyday Expense</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Ledger */}
      <div className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-outline-variant/30">
          <div className="p-3.5 sm:p-4">
            <span className="font-label-caps text-[10px] sm:text-[11px] text-secondary uppercase tracking-wider font-semibold">
              Confirmed Advances (Ledger)
            </span>
            <div className="font-metric-display text-xl sm:text-2xl lg:text-[26px] font-semibold text-primary mt-1">
              ₹{approvedTotal.toLocaleString('en-IN')}
            </div>
            <span className="font-label-code text-[10px] sm:text-[11px] text-emerald-700 mt-1 block">Credited to customer balances</span>
          </div>

          <div className="p-3.5 sm:p-4">
            <span className="font-label-caps text-[10px] sm:text-[11px] text-secondary uppercase tracking-wider font-semibold">
              Pending Confirmation
            </span>
            <div className="font-metric-display text-xl sm:text-2xl lg:text-[26px] font-semibold text-amber-800 mt-1">
              {pendingCount} <span className="font-label-code text-[11px] sm:text-[12px] text-secondary font-normal">requests</span>
            </div>
            <span className="font-label-code text-[10px] sm:text-[11px] text-secondary mt-1 block">Zero balance impact until confirmed</span>
          </div>

          <div className="p-3.5 sm:p-4">
            <span className="font-label-caps text-[10px] sm:text-[11px] text-secondary uppercase tracking-wider font-semibold">
              Total Everyday Expenses
            </span>
            <div className="font-metric-display text-xl sm:text-2xl lg:text-[26px] font-semibold text-primary mt-1">
              ₹{totalExpenses.toLocaleString('en-IN')}
            </div>
            <span className="font-label-code text-[10px] sm:text-[11px] text-secondary mt-1 block">Food, tolls, fuel, fleet upkeep</span>
          </div>

          <div className="p-3.5 sm:p-4">
            <span className="font-label-caps text-[10px] sm:text-[11px] text-secondary uppercase tracking-wider font-semibold">
              Governance Status
            </span>
            <div className="font-metric-display text-base sm:text-[18px] font-bold text-emerald-700 mt-1 sm:mt-2">
              {isManager ? 'Manager Authorized' : 'Staff Restricted'}
            </div>
            <span className="font-label-code text-[10px] sm:text-[11px] text-secondary mt-1 block">
              {isManager ? 'Approval rights active' : 'Awaiting manager confirmation'}
            </span>
          </div>
        </div>
      </div>

      {/* 1. ADVANCES SECTION */}
      {activeFinanceTab === 'advances' && (
        <div className="flex flex-col space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {[
              { id: 'all', label: 'All Advances', count: filteredData.advances.length },
              { id: 'pending', label: 'Pending Confirmation', count: pendingCount, isPending: true },
              { id: 'approved', label: 'Confirmed & Credited', count: null },
              { id: 'rejected', label: 'Rejected', count: null },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded text-[11px] sm:text-[12px] font-medium transition-colors inline-flex items-center gap-1.5 shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-primary text-on-primary font-semibold shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-label-code font-bold inline-flex items-center justify-center min-w-[16px] h-4 leading-none ${
                      statusFilter === tab.id
                        ? tab.isPending && tab.count > 0
                          ? 'bg-amber-400 text-stone-950'
                          : 'bg-surface-container-lowest/25 text-white'
                        : tab.isPending && tab.count > 0
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-surface-container-high text-secondary'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Advances Table */}
          <div className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded overflow-hidden shadow-sm">
            <div className="overflow-x-auto w-full">
              <table className="w-full border-collapse text-left min-w-[700px]">
                <thead>
                  <tr className="bg-surface-container-low/70 h-10 select-none border-b border-outline-variant/30 font-label-caps text-[11px] text-secondary uppercase">
                    <th className="px-5 font-semibold">Advance Reference</th>
                    <th className="px-4 font-semibold">Customer Account</th>
                    <th className="px-4 text-right font-semibold">Advance Amount</th>
                    <th className="px-4 font-semibold">Payment Instrument</th>
                    <th className="px-4 font-semibold">Reference Document</th>
                    <th className="px-4 text-center font-semibold">Status</th>
                    <th className="px-5 text-right font-semibold">
                      {isManager ? 'Manager Action' : 'Approval State'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 text-[13px] font-body-md text-on-surface">
                  {displayedAdvances.map((adv) => {
                    const customer = filteredData.customers.find((c) => c.id === adv.customer_id);
                    const isPending = adv.status === 'pending';
                    const isApproved = adv.status === 'approved';

                    return (
                      <tr key={adv.id} className="h-14 hover:bg-surface-container-low/40 transition-colors">
                        <td className="px-5 py-2 font-label-code text-[12px] font-bold text-primary">
                          {adv.advance_number}
                        </td>
                        <td className="px-4 py-2">
                          <div className="font-semibold text-primary">{adv.customer_name || (customer ? customer.name : 'Customer Consignee')}</div>
                          {adv.request_notes && <div className="text-[11px] text-secondary truncate max-w-xs font-label-code">"{adv.request_notes}"</div>}
                        </td>
                        <td className="px-4 py-2 text-right font-label-code font-bold text-[14px] tabular-nums text-primary">
                          ₹{Number(adv.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-2 text-secondary text-[12px]">
                          {adv.payment_method || 'Bank Wire'}
                        </td>
                        <td className="px-4 py-2 font-label-code text-[11px] text-secondary">
                          {adv.reference_document || '—'}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 font-label-caps text-[10px] rounded font-bold uppercase border ${
                              isApproved
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : isPending
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {isPending ? 'Pending Confirmation' : adv.status}
                          </span>
                        </td>
                        <td className="px-5 py-2 text-right">
                          {isPending ? (
                            isManager ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenReview(adv, 'approve')}
                                  className="px-2.5 py-1 bg-emerald-700 text-white rounded text-[11px] font-semibold hover:bg-emerald-800"
                                >
                                  Confirm & Add to DB
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenReview(adv, 'reject')}
                                  className="px-2 py-1 bg-rose-700 text-white rounded text-[11px] font-semibold hover:bg-rose-800"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="font-label-code text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Awaiting Manager Confirmation
                              </span>
                            )
                          ) : (
                            <span className="font-label-code text-[11px] text-secondary">
                              {isApproved ? 'Credited to Balance' : 'Rejected'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {displayedAdvances.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-secondary font-body-md">
                        No customer advances found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. EVERYDAY OPERATIONAL EXPENSES SECTION */}
      {activeFinanceTab === 'expenses' && (
        <div className="flex flex-col space-y-4">
          <div className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded overflow-hidden shadow-sm">
            <div className="overflow-x-auto w-full">
              <table className="w-full border-collapse text-left min-w-[700px]">
                <thead>
                  <tr className="bg-surface-container-low/70 h-10 select-none border-b border-outline-variant/30 font-label-caps text-[11px] text-secondary uppercase">
                    <th className="px-5 font-semibold">Expense #</th>
                    <th className="px-4 font-semibold">Expense Category</th>
                    <th className="px-4 font-semibold">Staff Member</th>
                    <th className="px-4 text-right font-semibold">Amount (₹)</th>
                    <th className="px-4 font-semibold">Receipt / Proof</th>
                    <th className="px-4 font-semibold">Remarks</th>
                    <th className="px-5 text-right font-semibold">Date Logged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 text-[13px] font-body-md text-on-surface">
                  {dataStore.everydayExpenses.map((exp) => (
                    <tr key={exp.id} className="h-14 hover:bg-surface-container-low/40 transition-colors">
                      <td className="px-5 py-2 font-label-code font-bold text-primary">{exp.expense_number}</td>
                      <td className="px-4 py-2">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-surface-container text-primary border border-outline-variant/40">
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-medium">{exp.spent_by_name}</td>
                      <td className="px-4 py-2 text-right font-label-code font-bold text-rose-700">₹{Number(exp.amount).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2">
                        {exp.receipt_url ? (
                          <a
                            href={exp.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-label-code text-primary bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/40 hover:underline"
                          >
                            <span className="material-symbols-outlined text-[14px]">receipt</span>
                            <span>View Receipt</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-secondary font-label-code">No receipt attached</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-secondary text-[12px]">{exp.notes || '—'}</td>
                      <td className="px-5 py-2 text-right font-label-code text-[11px] text-outline">
                        {new Date(exp.date || exp.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {dataStore.everydayExpenses.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-secondary font-body-md">
                        No everyday expenses logged yet. Click "+ Add Everyday Expense" to track food, highway tolls, or maintenance.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Customer Advance (Manager Only) */}
      <Modal
        isOpen={Boolean(reviewAdvance)}
        onClose={() => setReviewAdvance(null)}
        title={reviewAction === 'approve' ? 'Confirm Advance & Add to Customer Balance' : 'Reject Customer Advance'}
      >
        {reviewAdvance && (
          <div className="space-y-4">
            <div className="p-3 bg-surface-container-low border border-outline-variant/30 rounded flex justify-between">
              <div>
                <span className="text-[11px] font-label-caps uppercase text-secondary">Advance Reference</span>
                <div className="font-label-code font-bold text-primary">{reviewAdvance.advance_number}</div>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-label-caps uppercase text-secondary">Confirmed Amount</span>
                <div className="font-label-code font-bold text-emerald-700">₹{Number(reviewAdvance.amount).toLocaleString('en-IN')}</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Manager Audit Remarks</label>
              <textarea
                className="form-textarea w-full text-body-md"
                placeholder="Bank receipt verified, UTR validated, authorized for fuel uplift..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReviewAdvance(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={`btn btn-sm ${reviewAction === 'approve' ? 'btn-success' : 'btn-danger'}`}
                onClick={handleConfirmReview}
              >
                {reviewAction === 'approve' ? 'Confirm & Add to Customer Balance' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Request Advance (Staff or Manager) */}
      <Modal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        title="Record Customer Advance Amount (Pending Manager Confirmation)"
      >
        <form onSubmit={handleCreateAdvanceRequest} className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-[12px] text-amber-900">
            <strong>Rule:</strong> Advance amount will only be added to the customer's balance in the database after formal confirmation from the Operations Manager.
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Customer Consignee</label>
            <select
              className="form-select"
              value={requestData.customer_id}
              onChange={(e) => setRequestData({ ...requestData, customer_id: e.target.value })}
              required
            >
              {filteredData.customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.company_name || 'Client'})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Advance Amount (₹ INR)</label>
            <input
              type="number"
              step="1"
              className="form-input font-label-code font-bold text-[16px]"
              placeholder="0"
              value={requestData.amount}
              onChange={(e) => setRequestData({ ...requestData, amount: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Payment Channel</label>
              <select
                className="form-select"
                value={requestData.payment_method}
                onChange={(e) => setRequestData({ ...requestData, payment_method: e.target.value })}
              >
                <option value="bank_transfer">RTGS / NEFT Wire</option>
                <option value="cash">Direct Cash</option>
                <option value="cheque">Bank Demand Draft</option>
                <option value="upi">Corporate UPI</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">UTR / Cheque Number</label>
              <input
                type="text"
                className="form-input font-label-code"
                placeholder="UTR / Ref Number"
                value={requestData.reference_document}
                onChange={(e) => setRequestData({ ...requestData, reference_document: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Advance Notes / Purpose</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Advance notes or purpose..."
              value={requestData.request_notes}
              onChange={(e) => setRequestData({ ...requestData, request_notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsRequestModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Submit Advance for Manager Confirmation
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Everyday Operational Expense */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title="Add Everyday Operational Expense"
      >
        <form onSubmit={handleCreateExpense} className="space-y-4">
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Expense Category</label>
            <select
              className="form-select"
              value={expenseForm.category}
              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
            >
              <option value="Food & Meals">Food & Meals Allowance</option>
              <option value="Toll & Fastag">Highway Toll & Fastag Recharge</option>
              <option value="Vehicle Maintenance">Vehicle Maintenance & Tyre Puncture</option>
              <option value="Driver Daily Allowance">Driver Daily Operating Allowance</option>
              <option value="Petty Cash & Misc">Station Petty Cash & Miscellaneous</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Expense Amount (₹ INR)</label>
            <input
              type="number"
              step="1"
              className="form-input font-label-code font-bold text-rose-700 text-[16px]"
              placeholder="0"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Upload Bill / Receipt Slip</label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.heic,.pdf"
              onChange={handleReceiptUpload}
              className="text-[12px] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[12px] file:font-semibold file:bg-surface-container file:text-primary hover:file:bg-surface-container-high cursor-pointer"
            />
            {expenseForm.receipt_filename && (
              <span className="font-label-code text-[11px] text-emerald-700 mt-1 block">
                Attached: {expenseForm.receipt_filename}
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Description / Location</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Expense description, location, or notes..."
              value={expenseForm.notes}
              onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsExpenseModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Everyday Expense
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
