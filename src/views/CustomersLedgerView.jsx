import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../lib/dataStore';
import Modal from '../components/Modal';

export default function CustomersLedgerView() {
  const { currentUser, isManager, triggerRefresh } = useAuth();
  const filteredData = dataStore.getFilteredData(currentUser);
  const financialSummaries = dataStore.getCustomerFinancialSummaries();

  const [searchTerm, setSearchTerm] = useState('');
  const [corridorFilter, setCorridorFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [selectedCustomerForAction, setSelectedCustomerForAction] = useState(null);

  // Forms
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentNotes, setPaymentNotes] = useState('');

  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceMethod, setAdvanceMethod] = useState('bank_transfer');
  const [advanceRef, setAdvanceRef] = useState('');
  const [advanceNotes, setAdvanceNotes] = useState('');

  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  const [editCustomerForm, setEditCustomerForm] = useState({
    id: '',
    customer_code: '',
    name: '',
    company_name: '',
    gst_number: '',
    email: '',
    phone: '',
    billing_address: '',
    credit_limit: '',
  });

  const [customerToDelete, setCustomerToDelete] = useState(null);

  const [customerForm, setCustomerForm] = useState({
    customer_code: '',
    name: '',
    company_name: '',
    gst_number: '',
    email: '',
    phone: '',
    billing_address: '',
    credit_limit: '5000000',
  });

  const totalCustomersCount = filteredData.customers.length;
  const totalCreditExposure = financialSummaries.reduce((sum, s) => sum + (s.current_outstanding_balance || 0), 0);

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!isManager) {
      alert('Access Denied: Only Operations Managers are authorized to register customer accounts.');
      return;
    }
    if (!customerForm.customer_code || !customerForm.name) {
      alert('Customer code and name are required.');
      return;
    }
    try {
      await dataStore.createCustomer(customerForm, currentUser);
      setIsCustomerModalOpen(false);
      setCustomerForm({
        customer_code: '',
        name: '',
        company_name: '',
        gst_number: '',
        email: '',
        phone: '',
        billing_address: '',
        credit_limit: '5000000',
      });
      triggerRefresh();
      alert('Customer registered successfully!');
    } catch (err) {
      alert('Failed to create customer: ' + err.message);
    }
  };

  const handleOpenEditCustomer = (cust) => {
    const raw = cust.raw || cust;
    setEditCustomerForm({
      id: raw.id,
      customer_code: raw.customer_code || cust.code || '',
      name: raw.name || cust.name || '',
      company_name: raw.company_name || cust.company || '',
      gst_number: raw.gst_number || raw.gstin || cust.gstin || '',
      email: raw.email || '',
      phone: raw.phone || cust.phone || '',
      billing_address: raw.billing_address || '',
      credit_limit: String(raw.credit_limit !== undefined ? raw.credit_limit : (cust.limit || 0)),
    });
    setIsEditCustomerModalOpen(true);
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    if (!isManager) {
      alert('Access Denied: Only Operations Managers can edit customer accounts.');
      return;
    }
    if (!editCustomerForm.customer_code || !editCustomerForm.name) {
      alert('Customer code and entity name are required.');
      return;
    }
    try {
      await dataStore.updateCustomer(editCustomerForm.id, editCustomerForm, currentUser);
      setIsEditCustomerModalOpen(false);
      triggerRefresh();
      alert('Customer account updated successfully!');
    } catch (err) {
      alert('Failed to update customer: ' + err.message);
    }
  };

  const handleDeleteCustomer = (cust) => {
    if (!isManager) {
      alert('Access Denied: Only Operations Managers can delete customer accounts.');
      return;
    }
    setCustomerToDelete(cust.raw || cust);
  };

  const handleConfirmDeleteCustomer = async () => {
    if (!customerToDelete) return;
    try {
      await dataStore.deleteCustomer(customerToDelete.id, currentUser);
      setCustomerToDelete(null);
      triggerRefresh();
      alert(`Customer "${customerToDelete.name}" deleted successfully.`);
    } catch (err) {
      alert('Cannot delete customer: ' + err.message);
    }
  };

  // Staff or Manager: Record Paid Amount from Customer
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedCustomerForAction || !paymentAmount || Number(paymentAmount) <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }
    try {
      await dataStore.recordCustomerPayment(
        selectedCustomerForAction.id,
        Number(paymentAmount),
        paymentMethod,
        paymentNotes,
        currentUser
      );
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentNotes('');
      triggerRefresh();
      alert('Payment successfully credited to customer ledger in Supabase!');
    } catch (err) {
      alert('Failed to record payment: ' + err.message);
    }
  };

  // Staff or Manager: Submit Customer Advance Amount (Pending Manager Confirmation)
  const handleRequestAdvance = async (e) => {
    e.preventDefault();
    if (!selectedCustomerForAction || !advanceAmount || Number(advanceAmount) <= 0) {
      alert('Please enter a valid advance amount.');
      return;
    }
    try {
      await dataStore.requestAdvance(
        {
          customer_id: selectedCustomerForAction.id,
          amount: Number(advanceAmount),
          payment_method: advanceMethod,
          reference_document: advanceRef,
          request_notes: advanceNotes,
        },
        currentUser
      );
      setIsAdvanceModalOpen(false);
      setAdvanceAmount('');
      setAdvanceRef('');
      setAdvanceNotes('');
      triggerRefresh();
      alert('Customer advance request logged! Under governance rules, this advance will affect customer balance ONLY AFTER confirmation from the Operations Manager.');
    } catch (err) {
      alert('Failed to submit advance: ' + err.message);
    }
  };

  const openPaymentModal = (cust) => {
    setSelectedCustomerForAction(cust);
    setPaymentAmount('');
    setIsPaymentModalOpen(true);
  };

  const openAdvanceModal = (cust) => {
    setSelectedCustomerForAction(cust);
    setAdvanceAmount('');
    setIsAdvanceModalOpen(true);
  };

  const customerList = filteredData.customers.map((c) => {
    const summary = financialSummaries.find((s) => s.customer_id === c.id);
    const outstanding = summary?.current_outstanding_balance || 0;
    const limit = Number(c.credit_limit || 0);
    const usedPercent = limit > 0 ? Math.min(100, Math.round((outstanding / limit) * 100)) : 0;

    return {
      id: c.id,
      code: c.customer_code || `CUST-${c.id.slice(0, 4).toUpperCase()}`,
      name: c.name,
      company: c.company_name || 'Commercial Consignee',
      gstin: c.gstin || '—',
      corridor: 'Assigned Corridor',
      phone: c.phone || '—',
      limit: limit,
      outstanding: outstanding,
      usedPercent: usedPercent,
      status: limit > 0 && outstanding > limit * 0.9 ? 'High Risk' : 'Active',
      raw: c,
    };
  });

  const filteredCustomerList = customerList.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.gstin.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex flex-col w-full">
      {/* Title & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between pb-5 gap-4 border-b border-outline-variant/30 mb-6">
        <div>
          <div className="flex items-center gap-1.5 font-label-code text-[11px] text-secondary mb-1">
            <span>COMMERCIAL CONVEYANCE</span>
            <span>/</span>
            <span className="text-primary font-semibold">CUSTOMER REGISTRY & LEDGER</span>
          </div>
          <h1 className="font-headline-lg text-2xl lg:text-3xl text-primary tracking-tight font-semibold">
            Customers
          </h1>
          <p className="font-body-md text-[13px] text-secondary mt-0.5">
            Commercial consignees, credit limits, payments, and advance requests.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          {/* MANAGER ONLY: Add Customer */}
          {isManager ? (
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-on-primary text-[13px] font-semibold hover:bg-primary-container transition-colors shadow-sm rounded border border-primary"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>+ Add Customer (Manager)</span>
            </button>
          ) : (
            <div className="px-3 py-1.5 rounded bg-surface-container-low border border-outline-variant/30 text-[12px] font-label-code text-secondary">
              Staff Portal: Add Payment / Advance
            </div>
          )}
        </div>
      </div>

      {/* Operational Metric Ledger */}
      <div className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-outline-variant/30">
          <div className="p-3.5 sm:p-4">
            <div className="font-label-caps text-[10px] sm:text-[11px] text-secondary uppercase tracking-wider font-semibold">
              Total Active Customers
            </div>
            <div className="font-metric-display text-xl sm:text-2xl lg:text-[26px] font-semibold text-primary mt-1 tracking-tight">
              {totalCustomersCount} <span className="font-label-code text-[11px] sm:text-[12px] text-secondary font-normal">entities</span>
            </div>
            <span className="font-label-code text-[10px] sm:text-[11px] text-emerald-700 mt-1 block">Live Supabase ledger</span>
          </div>

          <div className="p-3.5 sm:p-4">
            <div className="font-label-caps text-[10px] sm:text-[11px] text-secondary uppercase tracking-wider font-semibold">
              Total Credit Exposure
            </div>
            <div className="font-metric-display text-xl sm:text-2xl lg:text-[26px] font-semibold text-primary mt-1 tracking-tight">
              ₹{totalCreditExposure.toLocaleString('en-IN')}
            </div>
            <span className="font-label-code text-[10px] sm:text-[11px] text-secondary mt-1 block">Net outstanding receivables</span>
          </div>

          <div className="p-3.5 sm:p-4">
            <div className="font-label-caps text-[10px] sm:text-[11px] text-secondary uppercase tracking-wider font-semibold">
              Payment Actions
            </div>
            <div className="font-metric-display text-lg sm:text-[20px] font-bold text-emerald-700 mt-1">
              + Pay / + Advance
            </div>
            <span className="font-label-code text-[10px] sm:text-[11px] text-secondary mt-1 block">Staff can log payments & advances</span>
          </div>

          <div className="p-3.5 sm:p-4">
            <div className="font-label-caps text-[10px] sm:text-[11px] text-secondary uppercase tracking-wider font-semibold">
              Advance Governance
            </div>
            <div className="font-metric-display text-base sm:text-[18px] font-bold text-primary mt-1">
              Dual-Custody
            </div>
            <span className="font-label-code text-[10px] sm:text-[11px] text-amber-800 mt-1 block">Advances require manager approval</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded p-3 sm:p-4 mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 shadow-sm">
        <div className="relative flex-1 min-w-0">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-outline">search</span>
          <input
            type="text"
            className="w-full h-10 pl-9 pr-3 bg-surface text-primary text-[13px] placeholder:text-outline focus:outline-none border border-outline-variant/40 rounded transition-colors"
            placeholder="Search customer name, account ID, GSTIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface px-2.5 h-10 border border-outline-variant/40 rounded">
            <span className="font-label-caps text-[11px] text-secondary mr-2 uppercase font-semibold">Status:</span>
            <select
              className="bg-transparent text-primary text-[12px] font-medium focus:outline-none cursor-pointer pr-2"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="High Risk">High Risk</option>
            </select>
          </div>
        </div>
      </div>

      {/* Primary Customer Ledger Table */}
      <div className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded overflow-hidden shadow-sm">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left min-w-[700px]">
            <thead>
              <tr className="bg-surface-container-low/70 h-10 select-none border-b border-outline-variant/30 font-label-caps text-[11px] text-secondary uppercase">
                <th className="px-5 font-semibold">Customer Account</th>
                <th className="px-4 font-semibold">Contact & Phone</th>
                <th className="px-4 font-semibold">Credit Limit & Utilization</th>
                <th className="px-4 text-right font-semibold">Outstanding Balance</th>
                <th className="px-4 text-center font-semibold">Risk Status</th>
                <th className="px-5 text-right font-semibold">Staff Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 text-[13px] font-body-md text-on-surface">
              {filteredCustomerList.map((cust) => (
                <tr key={cust.id} className="h-14 hover:bg-surface-container-low/40 transition-colors">
                  <td className="px-5 py-2">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-title-md text-[13px] text-primary font-bold">{cust.name}</span>
                        <span className="font-label-code text-[10px] bg-surface-container px-1 py-0.5 rounded text-secondary font-semibold">
                          {cust.code}
                        </span>
                      </div>
                      <div className="font-label-code text-[11px] text-secondary mt-0.5">{cust.company}</div>
                      {cust.gstin && cust.gstin !== '—' && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="font-label-caps text-[9px] uppercase px-1 py-0.2 bg-blue-50 text-blue-800 border border-blue-200 rounded font-bold">
                            GSTIN
                          </span>
                          <span className="font-label-code text-[11px] text-primary font-medium tracking-wide">
                            {cust.gstin}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-2 font-label-code text-[12px] text-secondary">
                    {cust.phone}
                  </td>

                  <td className="px-4 py-2">
                    <div className="flex flex-col gap-1 w-full max-w-[180px]">
                      <div className="flex justify-between items-center font-label-code text-[11px]">
                        <span className="text-secondary font-medium">₹{(cust.limit / 100000).toFixed(1)}L Max</span>
                        <span className="text-primary font-bold">{cust.usedPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-container overflow-hidden">
                        <div
                          className={`h-full ${cust.status === 'High Risk' ? 'bg-error' : 'bg-primary'}`}
                          style={{ width: `${cust.usedPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-2 text-right">
                    <span className="font-label-code text-[14px] font-bold text-primary">
                      ₹{Number(cust.outstanding).toLocaleString('en-IN')}
                    </span>
                  </td>

                  <td className="px-4 py-2 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 font-label-caps text-[10px] rounded font-bold uppercase border ${
                        cust.status === 'High Risk'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      {cust.status}
                    </span>
                  </td>

                  <td className="px-5 py-2 text-right">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      {/* Staff & Manager: Add Payment */}
                      <button
                        type="button"
                        onClick={() => openPaymentModal(cust.raw || cust)}
                        className="px-2 py-1 bg-emerald-700 text-white rounded text-[11px] font-semibold hover:bg-emerald-800 transition-colors"
                        title="Record payment received from customer (Cash/Bank/UPI)"
                      >
                        + Paid
                      </button>

                      {/* Staff & Manager: Request Customer Advance */}
                      <button
                        type="button"
                        onClick={() => openAdvanceModal(cust.raw || cust)}
                        className="px-2 py-1 bg-amber-600 text-white rounded text-[11px] font-semibold hover:bg-amber-700 transition-colors"
                        title="Submit customer advance request (added to balance upon manager confirmation)"
                      >
                        + Advance
                      </button>

                      {/* Manager Only: Edit & Delete Customer */}
                      {isManager && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEditCustomer(cust)}
                            className="p-1 text-primary hover:text-primary-container bg-surface-container-low hover:bg-surface-container border border-outline-variant/40 rounded transition-colors"
                            title="Edit Customer Account & GSTIN"
                          >
                            <span className="material-symbols-outlined text-[16px] block">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomer(cust)}
                            className="p-1 text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 rounded transition-colors"
                            title="Delete Customer Account"
                          >
                            <span className="material-symbols-outlined text-[16px] block">delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCustomerList.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-secondary font-body-md">
                    <div className="flex flex-col items-center justify-center">
                      <span className="material-symbols-outlined text-[36px] text-outline mb-2">person_off</span>
                      <p className="font-title-md text-[14px] text-primary font-semibold">No customers yet</p>
                      <p className="font-label-code text-[11px] text-outline mt-0.5">
                        {isManager
                          ? 'Click "+ Add Customer" above to register commercial consignees.'
                          : 'No customer accounts assigned to your station corridor.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Customer (Manager Only) */}
      <Modal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title="Register Commercial Customer (Manager Only)"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Customer Code</label>
              <input
                type="text"
                className="form-input uppercase font-label-code"
                placeholder="e.g. CUST-0142"
                value={customerForm.customer_code}
                onChange={(e) => setCustomerForm({ ...customerForm, customer_code: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">GST Number / GSTIN</label>
              <input
                type="text"
                className="form-input uppercase font-label-code"
                placeholder="e.g. 27AABCT9921M1ZX"
                maxLength={15}
                value={customerForm.gst_number}
                onChange={(e) => setCustomerForm({ ...customerForm, gst_number: e.target.value.toUpperCase() })}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Entity Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Acme Logistics Ltd"
              value={customerForm.name}
              onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Company Registered Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Acme Transport India Pvt Ltd"
              value={customerForm.company_name}
              onChange={(e) => setCustomerForm({ ...customerForm, company_name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Email Contact</label>
              <input
                type="email"
                className="form-input"
                placeholder="billing@customer.com"
                value={customerForm.email}
                onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Phone Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="+91 98000 00000"
                value={customerForm.phone}
                onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Billing Address</label>
            <input
              type="text"
              className="form-input"
              placeholder="Commercial registration address..."
              value={customerForm.billing_address}
              onChange={(e) => setCustomerForm({ ...customerForm, billing_address: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Approved Credit Limit (₹ INR)</label>
            <input
              type="number"
              className="form-input font-label-code"
              placeholder="5000000"
              value={customerForm.credit_limit}
              onChange={(e) => setCustomerForm({ ...customerForm, credit_limit: e.target.value })}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsCustomerModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Register Customer & Sync Supabase
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Customer (Manager Only) */}
      <Modal
        isOpen={isEditCustomerModalOpen}
        onClose={() => setIsEditCustomerModalOpen(false)}
        title="Edit Customer Account & GSTIN (Manager Only)"
      >
        <form onSubmit={handleUpdateCustomer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Customer Code</label>
              <input
                type="text"
                className="form-input uppercase font-label-code"
                placeholder="e.g. CUST-0142"
                value={editCustomerForm.customer_code}
                onChange={(e) => setEditCustomerForm({ ...editCustomerForm, customer_code: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">GST Number / GSTIN</label>
              <input
                type="text"
                className="form-input uppercase font-label-code"
                placeholder="e.g. 27AABCT9921M1ZX"
                maxLength={15}
                value={editCustomerForm.gst_number}
                onChange={(e) => setEditCustomerForm({ ...editCustomerForm, gst_number: e.target.value.toUpperCase() })}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Entity Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Acme Logistics Ltd"
              value={editCustomerForm.name}
              onChange={(e) => setEditCustomerForm({ ...editCustomerForm, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Company Registered Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Acme Transport India Pvt Ltd"
              value={editCustomerForm.company_name}
              onChange={(e) => setEditCustomerForm({ ...editCustomerForm, company_name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Email Contact</label>
              <input
                type="email"
                className="form-input"
                placeholder="billing@customer.com"
                value={editCustomerForm.email}
                onChange={(e) => setEditCustomerForm({ ...editCustomerForm, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Phone Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="+91 98000 00000"
                value={editCustomerForm.phone}
                onChange={(e) => setEditCustomerForm({ ...editCustomerForm, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Billing Address</label>
            <input
              type="text"
              className="form-input"
              placeholder="Commercial registration address..."
              value={editCustomerForm.billing_address}
              onChange={(e) => setEditCustomerForm({ ...editCustomerForm, billing_address: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Approved Credit Limit (₹ INR)</label>
            <input
              type="number"
              className="form-input font-label-code"
              placeholder="5000000"
              value={editCustomerForm.credit_limit}
              onChange={(e) => setEditCustomerForm({ ...editCustomerForm, credit_limit: e.target.value })}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsEditCustomerModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Update Customer & Save
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Confirm Delete Customer (Manager Only) */}
      <Modal
        isOpen={Boolean(customerToDelete)}
        onClose={() => setCustomerToDelete(null)}
        title="Confirm Delete Customer Account"
        maxWidth="460px"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded text-rose-900 text-[13px]">
            <span className="material-symbols-outlined text-rose-600 text-[22px] shrink-0 mt-0.5">warning</span>
            <div>
              <p className="font-semibold text-rose-800">Permanent Action</p>
              <p className="mt-0.5 text-rose-700 leading-relaxed">
                Are you sure you want to delete customer account <strong className="text-rose-950 font-bold">{customerToDelete?.name}</strong> ({customerToDelete?.customer_code || customerToDelete?.code})?
              </p>
            </div>
          </div>

          <p className="text-[12px] text-secondary leading-relaxed font-label-code">
            This will permanently remove the commercial account from the system ledger. Accounts with linked stations, deliveries, or transactions cannot be deleted.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/30">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setCustomerToDelete(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[13px] font-semibold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              onClick={handleConfirmDeleteCustomer}
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              <span>Confirm Delete</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Record Paid Amount from Customer (Staff & Manager) */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Paid Amount from Customer"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div className="p-3 bg-surface-container-low border border-outline-variant/30 rounded flex justify-between">
            <div>
              <span className="text-[11px] font-label-caps uppercase text-secondary">Customer Account</span>
              <div className="font-title-md font-bold text-primary">{selectedCustomerForAction?.name}</div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-label-caps uppercase text-secondary">Current Outstanding</span>
              <div className="font-label-code text-primary font-bold">
                ₹{Number(selectedCustomerForAction?.outstanding || 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Payment Amount Received (₹ INR)</label>
            <input
              type="number"
              step="1"
              className="form-input font-label-code font-bold text-emerald-800 text-[16px]"
              placeholder="e.g. 500000"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Payment Channel</label>
            <select
              className="form-select"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="bank_transfer">RTGS / NEFT Wire</option>
              <option value="cash">Direct Cash Collection</option>
              <option value="upi">Corporate UPI / QR</option>
              <option value="cheque">Bank Demand Draft / Cheque</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">UTR / Receipt Reference Number</label>
            <input
              type="text"
              className="form-input font-label-code"
              placeholder="e.g. UTR-HDFC-99210492"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsPaymentModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-success btn-sm">
              Post Payment to Supabase Ledger
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Request Advance Amount from Customer (Pending Manager Confirmation) */}
      <Modal
        isOpen={isAdvanceModalOpen}
        onClose={() => setIsAdvanceModalOpen(false)}
        title="Record Customer Advance Amount (Requires Manager Confirmation)"
      >
        <form onSubmit={handleRequestAdvance} className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-[12px] text-amber-900 flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] text-amber-700 mt-0.5">verified_user</span>
            <div>
              <strong>Manager Confirmation Rule:</strong> The advance amount entered here will be logged in the database as <code>PENDING</code>. It will be added to the customer's active financial balance <strong>only after the Operations Manager reviews and confirms it</strong>.
            </div>
          </div>

          <div className="p-3 bg-surface-container-low border border-outline-variant/30 rounded flex justify-between">
            <div>
              <span className="text-[11px] font-label-caps uppercase text-secondary">Customer Account</span>
              <div className="font-title-md font-bold text-primary">{selectedCustomerForAction?.name}</div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-label-caps uppercase text-secondary">Credit Limit</span>
              <div className="font-label-code text-secondary">
                ₹{Number(selectedCustomerForAction?.credit_limit || 5000000).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Advance Amount Paid by Customer (₹ INR)</label>
            <input
              type="number"
              step="1"
              className="form-input font-label-code font-bold text-primary text-[16px]"
              placeholder="e.g. 250000"
              value={advanceAmount}
              onChange={(e) => setAdvanceAmount(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Payment Instrument</label>
              <select
                className="form-select"
                value={advanceMethod}
                onChange={(e) => setAdvanceMethod(e.target.value)}
              >
                <option value="bank_transfer">RTGS / NEFT Wire</option>
                <option value="cash">Direct Cash Deposit</option>
                <option value="upi">Corporate UPI</option>
                <option value="cheque">Bank Demand Draft</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Reference / UTR / Cheque #</label>
              <input
                type="text"
                className="form-input font-label-code"
                placeholder="UTR-HDFC-882104"
                value={advanceRef}
                onChange={(e) => setAdvanceRef(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Purpose / Advance Notes</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Advance deposit for upcoming bulk high-speed diesel uplift..."
              value={advanceNotes}
              onChange={(e) => setAdvanceNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsAdvanceModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Submit Advance for Manager Confirmation
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
