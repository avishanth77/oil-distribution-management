import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../lib/dataStore';
import Modal from '../components/Modal';

export default function DeliveriesView() {
  const { currentUser, isManager, triggerRefresh } = useAuth();
  const filteredData = dataStore.getFilteredData(currentUser);

  // Tabs: 'dispatch' | 'manifest' | 'factory' | 'vehicle_fuel' | 'station_invoice'
  const [activeTabMode, setActiveTabMode] = useState('dispatch');
  const [searchTerm, setSearchTerm] = useState('');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isFactoryModalOpen, setIsFactoryModalOpen] = useState(false);
  const [isVehicleFuelModalOpen, setIsVehicleFuelModalOpen] = useState(false);

  // Invoice Plotter state
  const [selectedStationForInvoice, setSelectedStationForInvoice] = useState(filteredData.stations[0]?.id || '');
  const [selectedDeliveryForInvoice, setSelectedDeliveryForInvoice] = useState(filteredData.deliveries[0]?.id || '');

  // Form: Fuel Product (Manager Only)
  const [productForm, setProductForm] = useState({
    product_code: '',
    name: '',
    current_unit_price: '',
    unit_of_measure: 'Liters',
  });

  // Form: Delivery to Customer Station
  const defaultStation = filteredData.stations[0] || null;
  const defaultProduct = filteredData.products[0] || null;

  const [selectedStationId, setSelectedStationId] = useState(defaultStation?.id || '');
  const [selectedCustomerId, setSelectedCustomerId] = useState(filteredData.customers[0]?.id || '');
  const [selectedProductCode, setSelectedProductCode] = useState(defaultProduct?.product_code || '');
  const [quantity, setQuantity] = useState('');
  const [unitRate, setUnitRate] = useState(defaultProduct?.current_unit_price || '');
  const [tankerNumber, setTankerNumber] = useState('');
  const [driverName, setDriverName] = useState(currentUser?.full_name || '');
  const [dispatchDate, setDispatchDate] = useState(new Date().toLocaleDateString('en-GB'));
  const [shift, setShift] = useState('Shift 1 (06:00 - 14:00 · Morning)');
  const [corridor, setCorridor] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');

  // Form: Factory Fuel Intake (Fuel filled from factory + Invoice upload)
  const [factoryForm, setFactoryForm] = useState({
    factory_name: '',
    truck_plate_number: '',
    driver_name: currentUser?.full_name || '',
    fuel_name: '',
    quantity_liters: '',
    unit_cost: '',
    invoice_filename: '',
    invoice_url: '',
    notes: '',
  });

  // Form: Fuel Used by Company Vehicle
  const [vehicleFuelForm, setVehicleFuelForm] = useState({
    truck_plate_number: '',
    driver_name: currentUser?.full_name || '',
    fuel_liters: '',
    odometer_km: '',
    purpose: '',
  });

  // Calculations for Dispatch
  const grossAmount = (Number(quantity) || 0) * (Number(unitRate) || 0);
  const selectedCustomer = filteredData.customers.find((c) => c.id === selectedCustomerId) || filteredData.customers[0] || null;
  const currentCustomerBalance = selectedCustomer?.balance || 0;
  const creditLimit = Number(selectedCustomer?.credit_limit || 0);
  const newProjectedLedger = currentCustomerBalance + grossAmount;
  const creditUsagePercent = creditLimit > 0 ? Math.min(100, Math.round((newProjectedLedger / creditLimit) * 100)) : 0;

  // File reader for Factory Invoice Upload
  const handleInvoiceUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setFactoryForm((prev) => ({
        ...prev,
        invoice_filename: file.name,
        invoice_url: reader.result,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!isManager) {
      alert('Only Operations Managers can add new fuel grades.');
      return;
    }
    if (!productForm.product_code || !productForm.name || !productForm.current_unit_price) {
      alert('Product code, name, and unit price are required.');
      return;
    }
    try {
      await dataStore.createProduct(productForm, currentUser);
      setIsProductModalOpen(false);
      setProductForm({ product_code: '', name: '', current_unit_price: '', unit_of_measure: 'Liters' });
      triggerRefresh();
      alert('New fuel grade registered successfully!');
    } catch (err) {
      alert('Failed to create fuel product: ' + err.message);
    }
  };

  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    if (!quantity || quantity <= 0) {
      alert('Please enter a valid quantity.');
      return;
    }

    try {
      const station = filteredData.stations.find((s) => s.id === selectedStationId) || filteredData.stations[0];
      const product = filteredData.products.find((p) => p.product_code === selectedProductCode) || filteredData.products[0];

      await dataStore.recordFuelDelivery(
        {
          station_id: station?.id || null,
          fuel_product_id: product?.id || null,
          quantity_liters: Number(quantity),
          unit_price: Number(unitRate),
          total_amount: grossAmount,
          truck_plate_number: tankerNumber,
          driver_name: driverName,
          notes: dispatchNotes,
          route_id: station?.route_id || null,
          customer_id: selectedCustomer?.id || null,
        },
        currentUser
      );

      alert(`Delivery manifest successfully recorded! Customer balance debited: ₹${Math.round(grossAmount).toLocaleString('en-IN')}`);
      triggerRefresh();
      setActiveTabMode('manifest');
    } catch (err) {
      alert('Failed to record delivery: ' + err.message);
    }
  };

  const handleFactoryIntakeSubmit = async (e) => {
    e.preventDefault();
    if (!factoryForm.quantity_liters || Number(factoryForm.quantity_liters) <= 0) {
      alert('Please enter valid fuel quantity in liters.');
      return;
    }

    try {
      await dataStore.recordFactoryFuelIntake(factoryForm, currentUser);
      setIsFactoryModalOpen(false);
      triggerRefresh();
      alert('Factory fuel intake logged successfully with attached invoice!');
    } catch (err) {
      alert('Failed to log factory intake: ' + err.message);
    }
  };

  const handleVehicleFuelSubmit = async (e) => {
    e.preventDefault();
    if (!vehicleFuelForm.fuel_liters || Number(vehicleFuelForm.fuel_liters) <= 0) {
      alert('Please enter fuel liters consumed.');
      return;
    }

    try {
      await dataStore.recordVehicleConsumption(vehicleFuelForm, currentUser);
      setIsVehicleFuelModalOpen(false);
      triggerRefresh();
      alert('Vehicle fuel consumption logged successfully!');
    } catch (err) {
      alert('Failed to log vehicle fuel: ' + err.message);
    }
  };

  // Deliveries list
  const displayedDeliveries = filteredData.deliveries.filter((d) => {
    return (
      (d.delivery_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.driver_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.truck_plate_number || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Selected delivery for invoice plotting
  const targetDeliveryForInvoice =
    filteredData.deliveries.find((d) => d.id === selectedDeliveryForInvoice) ||
    filteredData.deliveries[0] ||
    null;

  const targetStationForInvoice =
    filteredData.stations.find((s) => s.id === selectedStationForInvoice) ||
    filteredData.stations[0] ||
    null;

  return (
    <div className="flex flex-col w-full">
      {/* Header Strip & Sub-navigation */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between pb-5 mb-6 border-b border-outline-variant/30 gap-4">
        <div>
          <div className="flex items-center gap-1.5 font-label-code text-[12px] text-secondary mb-1">
            <span className="text-secondary font-medium">PETROFLOW LOGISTICS</span>
            <span className="text-outline-variant">/</span>
            <span className="text-primary font-semibold">
              {activeTabMode === 'dispatch' && 'Station Fuel Dispatch'}
              {activeTabMode === 'manifest' && 'Logged Deliveries Manifest'}
              {activeTabMode === 'factory' && 'Factory Intake & Invoice Upload'}
              {activeTabMode === 'vehicle_fuel' && 'Company Vehicle Fuel Logs'}
              {activeTabMode === 'station_invoice' && 'Station Tax Invoice Plotter'}
            </span>
          </div>
          <h1 className="font-headline-lg text-2xl lg:text-3xl text-primary tracking-tight font-semibold">
            {activeTabMode === 'dispatch' && 'New Fuel Delivery'}
            {activeTabMode === 'manifest' && 'Delivered Dispatches'}
            {activeTabMode === 'factory' && 'Factory Fuel Intake & Invoices'}
            {activeTabMode === 'vehicle_fuel' && 'Fleet Vehicle Fuel Usage'}
            {activeTabMode === 'station_invoice' && 'Station Invoice Generator'}
          </h1>
          <p className="font-body-md text-[13px] text-on-surface-variant mt-1">
            Staff and managers can record refinery intakes, vehicle fuel, deliveries, and generate station invoices.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap items-center gap-2 max-w-full">
          <div className="overflow-x-auto max-w-full pb-1 -mx-1 px-1">
            <div className="inline-flex p-0.5 rounded bg-surface-container-low border border-outline-variant/30 min-w-max">
              <button
                type="button"
                onClick={() => setActiveTabMode('dispatch')}
                className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-[12px] font-medium rounded-sm transition-colors ${
                  activeTabMode === 'dispatch'
                    ? 'bg-primary text-on-primary font-semibold shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                + Dispatch Tanker
              </button>
            <button
              type="button"
              onClick={() => setActiveTabMode('factory')}
              className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-[12px] font-medium rounded-sm transition-colors inline-flex items-center gap-1.5 shrink-0 ${
                activeTabMode === 'factory'
                  ? 'bg-primary text-on-primary font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>Factory Intake</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-label-code font-bold min-w-[16px] h-4 inline-flex items-center justify-center leading-none ${
                activeTabMode === 'factory' ? 'bg-surface-container-lowest/25 text-white' : 'bg-surface-container-high text-secondary'
              }`}>
                {dataStore.factoryIntakes.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTabMode('vehicle_fuel')}
              className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-[12px] font-medium rounded-sm transition-colors inline-flex items-center gap-1.5 shrink-0 ${
                activeTabMode === 'vehicle_fuel'
                  ? 'bg-primary text-on-primary font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>Vehicle Fuel</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-label-code font-bold min-w-[16px] h-4 inline-flex items-center justify-center leading-none ${
                activeTabMode === 'vehicle_fuel' ? 'bg-surface-container-lowest/25 text-white' : 'bg-surface-container-high text-secondary'
              }`}>
                {dataStore.vehicleConsumptions.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTabMode('station_invoice')}
              className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-[12px] font-medium rounded-sm transition-colors ${
                activeTabMode === 'station_invoice'
                  ? 'bg-primary text-on-primary font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Station Invoice
            </button>
            <button
              type="button"
              onClick={() => setActiveTabMode('manifest')}
              className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-[12px] font-medium rounded-sm transition-colors inline-flex items-center gap-1.5 shrink-0 ${
                activeTabMode === 'manifest'
                  ? 'bg-primary text-on-primary font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>Log</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-label-code font-bold min-w-[16px] h-4 inline-flex items-center justify-center leading-none ${
                activeTabMode === 'manifest' ? 'bg-surface-container-lowest/25 text-white' : 'bg-surface-container-high text-secondary'
              }`}>
                {filteredData.deliveries.length}
              </span>
            </button>
          </div>
        </div>

        {/* Manager Only: Add Fuel Grade */}
        {isManager && (
          <button
            type="button"
            onClick={() => setIsProductModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest text-primary hover:bg-surface-container-low transition-colors rounded text-[12px] font-medium border border-outline-variant/40 shrink-0"
            title="Manager privilege: Add new fuel product/grade"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">add_circle</span>
            <span>+ Add Fuel Grade</span>
          </button>
        )}
      </div>
    </div>

    {/* 1. DISPATCH TO CUSTOMER STATION FORM */}
    {activeTabMode === 'dispatch' && (
      <form className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:gap-8 items-start" onSubmit={handleDispatchSubmit}>
        <div className="lg:col-span-7 flex flex-col space-y-4 sm:space-y-6">
            {/* Section 01: Customer Entity */}
            <div className="flex flex-col space-y-3 bg-surface-container-lowest border border-outline-variant/30 rounded p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
                <span className="font-label-caps text-[11px] uppercase text-secondary font-semibold tracking-wider">
                  01. Entity & Credit Account
                </span>
                <span className="font-label-code text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold">
                  CREDIT OK
                </span>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="font-title-md text-[13px] font-semibold text-on-surface">Customer Consignee</label>
                <div className="relative">
                  <select
                    className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded font-body-md text-[13px] text-primary focus:outline-none focus:border-primary transition-colors appearance-none"
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                  >
                    {filteredData.customers.length > 0 ? (
                      filteredData.customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · ACC #{c.id.slice(0, 8).toUpperCase()} ({c.company_name || 'Client'})
                        </option>
                      ))
                    ) : (
                      <option value="">-- No registered customers yet --</option>
                    )}
                  </select>
                  <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-secondary pointer-events-none text-[18px]">
                    expand_more
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between font-label-code text-[12px] bg-surface-container-low px-3 py-2 border border-outline-variant/30 rounded mt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-secondary">Customer:</span>
                    <span className="text-primary font-medium">{selectedCustomer ? selectedCustomer.name : 'None selected'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-secondary">Credit Limit: ₹{(creditLimit / 100000).toFixed(1)}L</span>
                    <span className="text-outline">·</span>
                    <span className="text-emerald-700 font-semibold">
                      Buffer: ₹{Math.max(0, creditLimit - currentCustomerBalance).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 02: Hydrocarbon Product */}
            <div className="flex flex-col space-y-3 bg-surface-container-lowest border border-outline-variant/30 rounded p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
                <span className="font-label-caps text-[11px] uppercase text-secondary font-semibold tracking-wider">
                  02. Hydrocarbon Product
                </span>
                <span className="font-label-code text-[11px] text-outline font-semibold">IS 1460:2017</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {filteredData.products.length > 0 ? (
                  filteredData.products.map((prod) => (
                    <button
                      key={prod.id || prod.product_code}
                      type="button"
                      onClick={() => {
                        setSelectedProductCode(prod.product_code);
                        setUnitRate(prod.current_unit_price);
                      }}
                      className={`h-16 flex flex-col justify-center px-3 border rounded text-left transition-all ${
                        selectedProductCode === prod.product_code
                          ? 'border-primary bg-primary-container/10 ring-1 ring-primary'
                          : 'border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container-low/50'
                      }`}
                    >
                      <span className="font-title-md text-[13px] font-bold text-primary leading-tight">
                        {prod.product_code}
                      </span>
                      <span className="font-label-code text-[11px] text-secondary truncate">
                        {prod.name}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="col-span-full p-4 rounded bg-surface-container-low border border-dashed border-outline-variant/40 text-center">
                    <p className="font-body-md text-[13px] text-secondary">No fuel grades registered yet.</p>
                    {isManager && (
                      <button
                        type="button"
                        onClick={() => setIsProductModalOpen(true)}
                        className="mt-1 text-primary hover:underline font-label-code text-[12px] font-bold inline-flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span>
                        <span>Register Fuel Grade</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="flex flex-col space-y-1">
                  <label className="font-title-md text-[13px] font-semibold text-on-surface">Gross Quantity</label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="e.g. 12000"
                      className="w-full h-10 pl-3 pr-14 bg-surface-container-lowest border border-outline-variant rounded font-label-code text-[15px] font-semibold text-primary focus:outline-none focus:border-primary transition-colors text-right"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                    <div className="absolute right-0 top-0 bottom-0 px-3 bg-surface-container-low border-l border-outline-variant/40 flex items-center justify-center font-label-code text-[12px] text-secondary">
                      Liters
                    </div>
                  </div>
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="font-title-md text-[13px] font-semibold text-on-surface">Unit Base Rate (₹)</label>
                  <div className="relative flex items-center">
                    <div className="absolute left-0 top-0 bottom-0 px-3 bg-surface-container-low border-r border-outline-variant/40 flex items-center justify-center font-label-code text-[12px] text-primary font-bold">
                      ₹
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 94.20"
                      className="w-full h-10 pl-9 pr-14 bg-surface-container-lowest border border-outline-variant rounded font-label-code text-[15px] font-semibold text-primary focus:outline-none focus:border-primary transition-colors text-right"
                      value={unitRate}
                      onChange={(e) => setUnitRate(e.target.value)}
                    />
                    <div className="absolute right-0 top-0 bottom-0 px-3 bg-surface-container-low border-l border-outline-variant/40 flex items-center justify-center font-label-code text-[12px] text-secondary">
                      per L
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 03: Route & Terminal */}
            <div className="flex flex-col space-y-3 bg-surface-container-lowest border border-outline-variant/30 rounded p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
                <span className="font-label-caps text-[11px] uppercase text-secondary font-semibold tracking-wider">
                  03. Terminal Point & Carrier
                </span>
                <span className="font-label-code text-[11px] text-outline font-semibold">DEPOT DISPATCH</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="font-title-md text-[13px] font-semibold text-on-surface">Destination Station</label>
                  <select
                    className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded font-body-md text-[13px] text-primary focus:outline-none focus:border-primary transition-colors"
                    value={selectedStationId}
                    onChange={(e) => setSelectedStationId(e.target.value)}
                  >
                    {filteredData.stations.length > 0 ? (
                      filteredData.stations.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.station_code || 'DEPOT'})
                        </option>
                      ))
                    ) : (
                      <option value="">-- No registered stations yet --</option>
                    )}
                  </select>
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="font-title-md text-[13px] font-semibold text-on-surface">Tanker Plate Number</label>
                  <input
                    type="text"
                    placeholder="e.g. MH-12-AB-1234"
                    className="w-full h-10 px-3 uppercase bg-surface-container-lowest border border-outline-variant rounded font-label-code text-[13px] text-primary focus:outline-none focus:border-primary transition-colors"
                    value={tankerNumber}
                    onChange={(e) => setTankerNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="font-title-md text-[13px] font-semibold text-on-surface">Carrier Driver / Staff</label>
                  <input
                    type="text"
                    placeholder="e.g. Driver Full Name"
                    className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded font-body-md text-[13px] text-primary focus:outline-none focus:border-primary transition-colors"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="font-title-md text-[13px] font-semibold text-on-surface">Operational Shift</label>
                  <select
                    className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded font-body-md text-[13px] text-primary focus:outline-none focus:border-primary transition-colors"
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                  >
                    <option value="Shift 1 (06:00 - 14:00 · Morning)">Shift 1 (06:00 - 14:00 · Morning)</option>
                    <option value="Shift 2 (14:00 - 22:00 · Evening)">Shift 2 (14:00 - 22:00 · Evening)</option>
                    <option value="Shift 3 (22:00 - 06:00 · Night Cargo)">Shift 3 (22:00 - 06:00 · Night Cargo)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Financial & Stock Dock */}
          <div className="lg:col-span-5 flex flex-col space-y-6 lg:border-l lg:border-outline-variant/30 lg:pl-8">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30">
              <span className="font-label-caps text-[11px] uppercase text-secondary font-semibold tracking-wider">
                Financial & Inventory Impact
              </span>
              <span className="font-label-code text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                REALTIME
              </span>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant/40 rounded p-5 flex flex-col space-y-4 shadow-sm">
              <div className="grid grid-cols-2 gap-4 pb-3 border-b border-outline-variant/20">
                <div>
                  <span className="font-label-caps text-[11px] text-secondary uppercase block font-semibold">Volume Booked</span>
                  <span className="font-label-code text-xl text-primary font-bold">
                    {Number(quantity || 0).toLocaleString('en-IN')} L
                  </span>
                </div>
                <div>
                  <span className="font-label-caps text-[11px] text-secondary uppercase block font-semibold">Base Price / L</span>
                  <span className="font-label-code text-xl text-primary font-bold">
                    ₹{Number(unitRate || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col space-y-2 text-[13px]">
                <div className="flex justify-between items-center text-on-surface-variant font-medium">
                  <span>Subtotal (Excl. Tax)</span>
                  <span className="font-label-code text-primary font-semibold">₹{grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-on-surface-variant font-medium">
                  <span>State VAT & Cess</span>
                  <span className="font-label-code text-secondary">Included in Base Rate</span>
                </div>
              </div>

              <div className="pt-3 border-t border-outline-variant/30 flex flex-col space-y-1">
                <span className="font-label-caps text-[11px] text-secondary uppercase tracking-wider font-semibold">Total Payable Invoice</span>
                <div className="flex items-baseline justify-between">
                  <span className="font-metric-display text-3xl text-primary font-bold tracking-tight">
                    ₹{Math.round(grossAmount).toLocaleString('en-IN')}
                  </span>
                  <span className="font-label-code text-[12px] text-secondary">INR (Net)</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-11 bg-primary text-on-primary hover:bg-primary-container rounded font-title-md text-[14px] font-semibold transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">local_shipping</span>
              <span>Create Delivery & Update Stock</span>
            </button>
          </div>
        </form>
      )}

      {/* 2. FACTORY FUEL INTAKE (Fuel filled from factory + Invoice upload) */}
      {activeTabMode === 'factory' && (
        <div className="flex flex-col space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 bg-surface-container-lowest border border-outline-variant/30 rounded gap-3 shadow-sm">
            <div>
              <h2 className="font-title-lg text-[15px] sm:text-[16px] font-bold text-primary">Factory & Refinery Fuel Intakes</h2>
              <p className="text-[11px] sm:text-[12px] text-secondary">Staff can record bulk fuel loaded from refinery gates into company tankers with attached invoices.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsFactoryModalOpen(true)}
              className="inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-primary text-on-primary rounded text-[11px] sm:text-[12px] md:text-[13px] font-semibold shadow-sm hover:bg-primary-container shrink-0 self-start sm:self-auto"
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[16px]">add_circle</span>
              <span>+ Record Factory Fuel Filled</span>
            </button>
          </div>

          <div className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded overflow-hidden shadow-sm">
            <div className="overflow-x-auto w-full">
              <table className="w-full border-collapse text-left min-w-[720px]">
                <thead>
                  <tr className="bg-surface-container-low/70 h-10 select-none border-b border-outline-variant/30 font-label-caps text-[11px] text-secondary uppercase">
                    <th className="px-5 font-semibold">Intake Ref #</th>
                    <th className="px-4 font-semibold">Refinery / Factory</th>
                    <th className="px-4 font-semibold">Tanker & Driver</th>
                    <th className="px-4 font-semibold">Fuel Grade</th>
                    <th className="px-4 text-right font-semibold">Liters Loaded</th>
                    <th className="px-4 text-right font-semibold">Total Cost (₹)</th>
                    <th className="px-4 text-center font-semibold">Factory Invoice</th>
                    <th className="px-5 text-right font-semibold">Intake Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 text-[13px] font-body-md text-on-surface">
                  {dataStore.factoryIntakes.map((fi) => (
                    <tr key={fi.id} className="h-14 hover:bg-surface-container-low/40 transition-colors">
                      <td className="px-5 py-2 font-label-code font-bold text-primary">{fi.intake_number}</td>
                      <td className="px-4 py-2 font-medium">{fi.factory_name}</td>
                      <td className="px-4 py-2">
                        <div className="font-semibold text-primary">{fi.truck_plate_number}</div>
                        <div className="text-[11px] text-secondary font-label-code">{fi.driver_name}</div>
                      </td>
                      <td className="px-4 py-2 font-medium text-on-surface">{fi.fuel_name}</td>
                      <td className="px-4 py-2 text-right font-label-code font-bold">{Number(fi.quantity_liters).toLocaleString()} L</td>
                      <td className="px-4 py-2 text-right font-label-code font-bold text-primary">₹{Number(fi.total_cost || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2 text-center">
                        {fi.invoice_url ? (
                          <a
                            href={fi.invoice_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-label-code text-primary bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/40 hover:underline"
                          >
                            <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                            <span>View Bill</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-secondary font-label-code">{fi.invoice_filename || 'No document'}</span>
                        )}
                      </td>
                      <td className="px-5 py-2 text-right font-label-code text-[11px] text-outline">
                        {new Date(fi.intake_date || fi.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {dataStore.factoryIntakes.length === 0 && (
                    <tr>
                      <td colSpan="8" className="text-center py-8 text-secondary font-body-md">
                        No factory fuel intakes recorded yet. Click "+ Record Factory Fuel Filled" to log refinery loading.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. COMPANY VEHICLE FUEL CONSUMPTION */}
      {activeTabMode === 'vehicle_fuel' && (
        <div className="flex flex-col space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 bg-surface-container-lowest border border-outline-variant/30 rounded gap-3 shadow-sm">
            <div>
              <h2 className="font-title-lg text-[15px] sm:text-[16px] font-bold text-primary">Company Vehicle Fuel Consumption</h2>
              <p className="text-[11px] sm:text-[12px] text-secondary">Staff can record fuel consumed by company tankers, pickups, and operations vehicles.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsVehicleFuelModalOpen(true)}
              className="inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-primary text-on-primary rounded text-[11px] sm:text-[12px] md:text-[13px] font-semibold shadow-sm hover:bg-primary-container shrink-0 self-start sm:self-auto"
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[16px]">local_gas_station</span>
              <span>+ Log Vehicle Fuel Used</span>
            </button>
          </div>

          <div className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded overflow-hidden shadow-sm">
            <div className="overflow-x-auto w-full">
              <table className="w-full border-collapse text-left min-w-[650px]">
                <thead>
                  <tr className="bg-surface-container-low/70 h-10 select-none border-b border-outline-variant/30 font-label-caps text-[11px] text-secondary uppercase">
                    <th className="px-5 font-semibold">Log #</th>
                    <th className="px-4 font-semibold">Vehicle Plate</th>
                    <th className="px-4 font-semibold">Driver / Staff</th>
                    <th className="px-4 text-right font-semibold">Fuel Consumed</th>
                    <th className="px-4 text-right font-semibold">Odometer (KM)</th>
                    <th className="px-4 font-semibold">Purpose / Destination</th>
                    <th className="px-5 text-right font-semibold">Date Logged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 text-[13px] font-body-md text-on-surface">
                  {dataStore.vehicleConsumptions.map((vc) => (
                    <tr key={vc.id} className="h-14 hover:bg-surface-container-low/40 transition-colors">
                      <td className="px-5 py-2 font-label-code font-bold text-primary">{vc.log_number}</td>
                      <td className="px-4 py-2 font-label-code font-bold text-primary">{vc.truck_plate_number}</td>
                      <td className="px-4 py-2 font-medium">{vc.driver_name}</td>
                      <td className="px-4 py-2 text-right font-label-code font-bold text-amber-800">{Number(vc.fuel_liters).toLocaleString()} L</td>
                      <td className="px-4 py-2 text-right font-label-code text-secondary">{vc.odometer_km ? `${Number(vc.odometer_km).toLocaleString()} km` : '—'}</td>
                      <td className="px-4 py-2 text-secondary">{vc.purpose}</td>
                      <td className="px-5 py-2 text-right font-label-code text-[11px] text-outline">
                        {new Date(vc.logged_date || vc.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {dataStore.vehicleConsumptions.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-secondary font-body-md">
                        No vehicle fuel usage logged yet. Click "+ Log Vehicle Fuel Used" to track internal fleet consumption.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. STATION INVOICE PLOTTER */}
      {activeTabMode === 'station_invoice' && (
        <div className="flex flex-col space-y-4 sm:space-y-6 w-full">
          {targetDeliveryForInvoice && targetStationForInvoice ? (
            <>
              {/* Controls Bar - Mobile & Tablet Optimized */}
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-3 sm:p-4 lg:p-5 flex flex-col lg:flex-row lg:items-end justify-between gap-3 sm:gap-4 shadow-sm print:hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-end gap-3 sm:gap-4 w-full lg:w-auto">
                  <div className="w-full lg:w-64">
                    <label className="font-label-caps text-[10px] sm:text-[11px] text-secondary uppercase font-semibold block mb-1">
                      Select Fuel Station
                    </label>
                    <select
                      className="w-full h-9 sm:h-10 px-3 bg-surface border border-outline-variant rounded font-body-md text-[12px] sm:text-[13px] text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer"
                      value={selectedStationForInvoice}
                      onChange={(e) => setSelectedStationForInvoice(e.target.value)}
                    >
                      {filteredData.stations.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.station_code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full lg:w-80">
                    <label className="font-label-caps text-[10px] sm:text-[11px] text-secondary uppercase font-semibold block mb-1">
                      Select Delivery Manifest
                    </label>
                    <select
                      className="w-full h-9 sm:h-10 px-3 bg-surface border border-outline-variant rounded font-body-md text-[12px] sm:text-[13px] text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer"
                      value={selectedDeliveryForInvoice}
                      onChange={(e) => setSelectedDeliveryForInvoice(e.target.value)}
                    >
                      {filteredData.deliveries.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.delivery_number} · {Number(d.quantity_liters).toLocaleString()}L (₹{Number(d.total_amount || 0).toLocaleString('en-IN')})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full sm:w-auto h-9 sm:h-10 px-4 bg-primary text-on-primary rounded font-semibold text-[12px] sm:text-[13px] inline-flex items-center justify-center gap-2 shadow-sm hover:bg-primary-container transition-colors cursor-pointer shrink-0"
                  title="Print or export invoice to PDF"
                >
                  <span className="material-symbols-outlined text-[16px] sm:text-[18px]">print</span>
                  <span>Print / Save Invoice (PDF)</span>
                </button>
              </div>

              {/* Rendered Tax Invoice Template */}
              <div className="bg-white border border-outline-variant/40 rounded-lg p-3.5 sm:p-6 md:p-8 max-w-4xl mx-auto w-full shadow-sm sm:shadow-md text-on-surface overflow-hidden print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none">
                {/* Invoice Top Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4 pb-4 sm:pb-6 border-b border-outline-variant/30">
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded bg-primary text-amber-400 flex items-center justify-center font-bold shrink-0 mt-0.5 shadow-xs">
                      <span className="material-symbols-outlined text-[20px] sm:text-[22px]">local_gas_station</span>
                    </div>
                    <div>
                      <h2 className="text-base sm:text-xl font-bold tracking-tight text-primary">
                        PetroFlow Distribution Corp
                      </h2>
                      <div className="text-[11px] sm:text-[12px] text-secondary leading-relaxed font-label-code mt-0.5">
                        <p>GSTIN: 27AABCT9921M1ZX · Commercial Wholesale License</p>
                        <p className="hidden sm:block">Terminal Distribution Hub & Depots</p>
                      </div>
                    </div>
                  </div>

                  {/* Invoice Number & Date Badge */}
                  <div className="w-full sm:w-auto bg-surface-container-low/60 sm:bg-transparent p-2.5 sm:p-0 rounded border sm:border-0 border-outline-variant/30 flex sm:flex-col justify-between sm:justify-start items-center sm:items-end">
                    <span className="font-label-caps text-[10px] sm:text-[11px] text-secondary uppercase font-bold tracking-wider">
                      COMMERCIAL TAX INVOICE
                    </span>
                    <div className="text-right">
                      <div className="font-label-code text-base sm:text-lg font-bold text-primary">
                        INV-{targetDeliveryForInvoice.delivery_number}
                      </div>
                      <div className="font-label-code text-[11px] sm:text-[12px] text-secondary">
                        Date: {new Date(targetDeliveryForInvoice.delivery_date || targetDeliveryForInvoice.created_at || Date.now()).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bill To & Station Point */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6 py-4 sm:py-6 border-b border-outline-variant/30 text-[12px] sm:text-[13px]">
                  {/* Station Delivery Destination */}
                  <div className="bg-surface-container-low/40 md:bg-transparent p-3 sm:p-3.5 md:p-0 rounded border border-outline-variant/20 md:border-0">
                    <span className="font-label-caps text-[10px] sm:text-[11px] text-secondary uppercase font-bold block mb-1">
                      Delivered To Station
                    </span>
                    <div className="font-bold text-primary text-[14px] sm:text-[15px]">
                      {targetStationForInvoice.name}
                    </div>
                    <div className="text-secondary text-[12px] sm:text-[13px] mt-0.5 break-words">
                      {targetStationForInvoice.address || 'Registered Fuel Delivery Depot'}
                    </div>
                    <div className="font-label-code text-[11px] text-secondary mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-semibold text-primary">Code: {targetStationForInvoice.station_code}</span>
                      {targetStationForInvoice.contact_person && (
                        <>
                          <span>·</span>
                          <span>Attn: {targetStationForInvoice.contact_person}</span>
                        </>
                      )}
                      {targetStationForInvoice.contact_phone && (
                        <>
                          <span>·</span>
                          <span>{targetStationForInvoice.contact_phone}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Transport Manifest Details */}
                  <div className="bg-surface-container-low/40 md:bg-transparent p-3 sm:p-3.5 md:p-0 rounded border border-outline-variant/20 md:border-0 text-left md:text-right">
                    <span className="font-label-caps text-[10px] sm:text-[11px] text-secondary uppercase font-bold block mb-1">
                      Transport Manifest Details
                    </span>
                    <div className="font-label-code text-[13px] sm:text-[14px] font-semibold text-primary">
                      Tanker Plate: {targetDeliveryForInvoice.truck_plate_number || 'Depot Tanker'}
                    </div>
                    <div className="text-secondary text-[12px] mt-0.5">
                      Authorized Carrier: {targetDeliveryForInvoice.driver_name || currentUser?.full_name || 'Carrier Fleet'}
                    </div>
                    <div className="font-label-code text-[11px] text-emerald-700 font-semibold mt-1.5 inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      <span>Verified Dispatch Manifest</span>
                    </div>
                  </div>
                </div>

                {/* Invoice Line Items */}
                <div className="py-4 sm:py-6 w-full">
                  <div className="overflow-x-auto -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
                    <table className="w-full text-left border-collapse text-[12px] sm:text-[13px] min-w-[420px] sm:min-w-[480px]">
                      <thead>
                        <tr className="border-b border-outline-variant/40 font-label-caps text-[10px] sm:text-[11px] text-secondary uppercase tracking-wider">
                          <th className="py-2.5 px-1">Item Description</th>
                          <th className="py-2.5 px-2 text-right">Volume</th>
                          <th className="py-2.5 px-2 text-right">Rate / L</th>
                          <th className="py-2.5 px-1 text-right">Taxable Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/20 font-label-code">
                        <tr>
                          <td className="py-3 px-1 font-medium text-primary">
                            <div className="font-semibold">
                              {filteredData.products.find((p) => p.id === targetDeliveryForInvoice.fuel_product_id)?.name || targetDeliveryForInvoice.product_name || 'Fuel Product'}
                            </div>
                            <div className="text-[10px] sm:text-[11px] text-secondary font-normal">
                              Commercial Wholesale Specification
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right font-bold text-primary whitespace-nowrap">
                            {Number(targetDeliveryForInvoice.quantity_liters).toLocaleString()} L
                          </td>
                          <td className="py-3 px-2 text-right text-secondary whitespace-nowrap">
                            ₹{Number(targetDeliveryForInvoice.unit_price || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-1 text-right font-bold text-primary whitespace-nowrap">
                            ₹{Number(targetDeliveryForInvoice.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Subtotal & Totals Summary */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end pt-4 sm:pt-6 gap-4">
                    <div className="text-[11px] text-secondary font-label-code max-w-sm leading-relaxed order-2 sm:order-1">
                      <p className="font-semibold text-primary mb-0.5">Commercial Dispatch Terms:</p>
                      <p>Volume temperature compensated at standard 15°C. Delivered in certified bulk gantry tanker.</p>
                    </div>

                    <div className="w-full sm:w-72 bg-surface-container-low/50 sm:bg-transparent p-3 sm:p-0 rounded border sm:border-0 border-outline-variant/30 space-y-1.5 sm:space-y-2 text-[12px] sm:text-[13px] order-1 sm:order-2">
                      <div className="flex justify-between font-label-code text-secondary">
                        <span>Subtotal:</span>
                        <span>₹{Number(targetDeliveryForInvoice.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between font-label-code text-secondary">
                        <span>State VAT (Incl.):</span>
                        <span>₹0.00</span>
                      </div>
                      <div className="flex justify-between font-label-code text-[14px] sm:text-[15px] font-bold text-primary border-t border-outline-variant/40 pt-2">
                        <span>Total Invoiced:</span>
                        <span>₹{Number(targetDeliveryForInvoice.total_amount || 0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Signatures & Seal Footer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8 pt-6 sm:pt-8 border-t border-outline-variant/30 text-[11px] sm:text-[12px] text-secondary font-label-code">
                  <div className="bg-surface-container-low/20 sm:bg-transparent p-3 sm:p-0 rounded border sm:border-0 border-outline-variant/20">
                    <div className="border-b border-outline-variant/40 pb-8 sm:pb-12 mb-1.5"></div>
                    <span className="font-semibold text-primary block">Station Receiver Signature & Stamp</span>
                    <p className="text-[10px] text-outline mt-0.5">Retail outlet / depot supervisor verification stamp</p>
                  </div>

                  <div className="bg-surface-container-low/20 sm:bg-transparent p-3 sm:p-0 rounded border sm:border-0 border-outline-variant/20 text-left sm:text-right">
                    <div className="border-b border-outline-variant/40 pb-8 sm:pb-12 mb-1.5"></div>
                    <span className="font-semibold text-primary block">Authorized PetroFlow Signatory</span>
                    <p className="text-[10px] text-outline mt-0.5">Driver / logistics officer endorsement</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-10 flex flex-col items-center justify-center text-center shadow-sm">
              <span className="material-symbols-outlined text-[40px] text-outline mb-2">receipt_long</span>
              <h3 className="font-title-lg text-lg font-bold text-primary">No delivery manifests or stations recorded yet</h3>
              <p className="font-body-md text-sm text-secondary max-w-md mt-1 mb-4">
                An invoice can be plotted once you have registered a fuel station and recorded at least one delivery manifest.
              </p>
              <button
                type="button"
                onClick={() => setActiveTabMode('dispatch')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-on-primary hover:bg-primary-container transition-colors rounded text-body-sm font-semibold shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Go to Dispatch Tanker</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. DELIVERIES MANIFEST LOG */}
      {activeTabMode === 'manifest' && (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded flex flex-col shadow-sm">
          <div className="p-4 border-b border-outline-variant/30 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[260px] max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-outline">search</span>
              <input
                type="text"
                placeholder="Search delivery #, driver, tanker plate..."
                className="w-full h-10 pl-9 pr-3 bg-surface text-[13px] text-primary rounded border border-outline-variant/40 focus:outline-none focus:border-primary"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => setActiveTabMode('dispatch')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded text-body-sm font-medium shadow-sm hover:bg-primary-container"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>+ Record New Delivery</span>
            </button>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="bg-surface-container-low/50 border-b border-outline-variant/30 font-label-caps text-[11px] text-secondary uppercase tracking-wider">
                  <th className="py-2.5 px-5 font-semibold">Delivery #</th>
                  <th className="py-2.5 px-4 font-semibold">Tanker & Driver</th>
                  <th className="py-2.5 px-4 font-semibold">Product</th>
                  <th className="py-2.5 px-4 text-right font-semibold">Quantity</th>
                  <th className="py-2.5 px-4 text-right font-semibold">Unit Price</th>
                  <th className="py-2.5 px-4 text-right font-semibold">Total Invoiced</th>
                  <th className="py-2.5 px-4 text-center font-semibold">Status</th>
                  <th className="py-2.5 px-5 text-right font-semibold">Date Stamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 font-body-md text-[13px]">
                {displayedDeliveries.map((del) => {
                  const product = filteredData.products.find((p) => p.id === del.fuel_product_id);
                  const isDelivered = (del.status || '').toLowerCase() === 'delivered';

                  return (
                    <tr key={del.id} className="hover:bg-surface-container-low/30 transition-colors">
                      <td className="py-3 px-5 font-label-code text-[12px] font-bold text-primary">
                        {del.delivery_number}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-primary">{del.truck_plate_number || 'Tanker Fleet'}</div>
                        <div className="text-[11px] text-secondary font-label-code">{del.driver_name}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-on-surface">
                        {product ? product.name : (del.product_name || 'HSD Diesel')}
                      </td>
                      <td className="py-3 px-4 text-right font-label-code tabular-nums text-on-surface">
                        {Number(del.quantity_liters).toLocaleString()} L
                      </td>
                      <td className="py-3 px-4 text-right font-label-code tabular-nums text-secondary">
                        ₹{Number(del.unit_price || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-label-code font-bold tabular-nums text-primary">
                        ₹{Number(del.total_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          isDelivered 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {del.status || 'Delivered'}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-right font-label-code text-[11px] text-outline">
                        {del.delivery_date ? new Date(del.delivery_date).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })}
                {displayedDeliveries.length === 0 && (
                  <tr>
                    <td colSpan="8" className="text-center py-12 text-secondary font-body-md">
                      <div className="flex flex-col items-center justify-center">
                        <span className="material-symbols-outlined text-[36px] text-outline mb-2">local_shipping</span>
                        <p className="font-title-md text-[14px] text-primary font-semibold">No sales records yet</p>
                        <p className="font-label-code text-[11px] text-outline mt-0.5">Logged dispatches will appear here once recorded</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Factory Fuel Intake + Invoice Upload */}
      <Modal
        isOpen={isFactoryModalOpen}
        onClose={() => setIsFactoryModalOpen(false)}
        title="Record Factory Fuel Filled & Upload Invoice"
      >
        <form onSubmit={handleFactoryIntakeSubmit} className="space-y-4">
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Refinery / Supply Factory Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Terminal Refinery Rack #3"
              value={factoryForm.factory_name}
              onChange={(e) => setFactoryForm({ ...factoryForm, factory_name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Tanker / Vehicle Plate</label>
              <input
                type="text"
                className="form-input uppercase font-label-code"
                placeholder="e.g. MH-12-AB-1234"
                value={factoryForm.truck_plate_number}
                onChange={(e) => setFactoryForm({ ...factoryForm, truck_plate_number: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Carrier Operator</label>
              <input
                type="text"
                className="form-input"
                placeholder="Driver or Operator Name"
                value={factoryForm.driver_name}
                onChange={(e) => setFactoryForm({ ...factoryForm, driver_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Quantity Filled (Liters)</label>
              <input
                type="number"
                step="10"
                className="form-input font-label-code font-bold text-primary"
                placeholder="e.g. 24000"
                value={factoryForm.quantity_liters}
                onChange={(e) => setFactoryForm({ ...factoryForm, quantity_liters: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Refinery Unit Cost (₹/L)</label>
              <input
                type="number"
                step="0.01"
                className="form-input font-label-code"
                placeholder="e.g. 89.50"
                value={factoryForm.unit_cost}
                onChange={(e) => setFactoryForm({ ...factoryForm, unit_cost: e.target.value })}
              />
            </div>
          </div>

          {/* Upload Factory Invoice File */}
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Upload Factory Invoice / Weight Slip</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleInvoiceUpload}
              className="text-[12px] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[12px] file:font-semibold file:bg-surface-container file:text-primary hover:file:bg-surface-container-high cursor-pointer"
            />
            {factoryForm.invoice_filename && (
              <span className="font-label-code text-[11px] text-emerald-700 mt-1 block">
                Attached: {factoryForm.invoice_filename}
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Gantry Notes / Meter Reading</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Gantry meter reading or quality clearance notes"
              value={factoryForm.notes}
              onChange={(e) => setFactoryForm({ ...factoryForm, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsFactoryModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Factory Intake & Invoice
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Company Vehicle Fuel Consumption */}
      <Modal
        isOpen={isVehicleFuelModalOpen}
        onClose={() => setIsVehicleFuelModalOpen(false)}
        title="Log Fuel Used by Company Vehicle"
      >
        <form onSubmit={handleVehicleFuelSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Vehicle Plate Number</label>
              <input
                type="text"
                className="form-input uppercase font-label-code"
                placeholder="e.g. MH-12-AB-1234"
                value={vehicleFuelForm.truck_plate_number}
                onChange={(e) => setVehicleFuelForm({ ...vehicleFuelForm, truck_plate_number: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Fuel Consumed (Liters)</label>
              <input
                type="number"
                step="0.5"
                className="form-input font-label-code font-bold text-amber-800"
                placeholder="e.g. 85"
                value={vehicleFuelForm.fuel_liters}
                onChange={(e) => setVehicleFuelForm({ ...vehicleFuelForm, fuel_liters: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Current Odometer (KM)</label>
            <input
              type="number"
              className="form-input font-label-code"
              placeholder="e.g. 48210"
              value={vehicleFuelForm.odometer_km}
              onChange={(e) => setVehicleFuelForm({ ...vehicleFuelForm, odometer_km: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Trip Purpose / Route Covered</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Corridor transit or customer delivery run"
              value={vehicleFuelForm.purpose}
              onChange={(e) => setVehicleFuelForm({ ...vehicleFuelForm, purpose: e.target.value })}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsVehicleFuelModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Vehicle Fuel Log
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Fuel Grade (Manager Only) */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title="Register Hydrocarbon Fuel Grade (Manager Only)"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Product Code</label>
            <input
              type="text"
              className="form-input uppercase"
              placeholder="e.g. HSD, MS, SPEED97, B20"
              value={productForm.product_code}
              onChange={(e) => setProductForm({ ...productForm, product_code: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Product Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. High-Speed Diesel Euro VI"
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Unit Base Rate (₹ per Liter)</label>
            <input
              type="number"
              step="0.01"
              className="form-input"
              placeholder="94.20"
              value={productForm.current_unit_price}
              onChange={(e) => setProductForm({ ...productForm, current_unit_price: e.target.value })}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsProductModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Register Fuel Grade
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
