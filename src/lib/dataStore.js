import { supabase, isSupabaseConfigured } from './supabase.js';
import {
  INITIAL_PROFILES,
  INITIAL_ROUTES,
  INITIAL_CUSTOMERS,
  INITIAL_STATIONS,
  INITIAL_PRODUCTS,
  INITIAL_STAFF_ROUTE_ASSIGNMENTS,
  INITIAL_STAFF_STATION_ASSIGNMENTS,
  INITIAL_DELIVERIES,
  INITIAL_ADVANCES,
  INITIAL_TRANSACTIONS,
  INITIAL_VEHICLES,
  INITIAL_FACTORY_INTAKES,
  INITIAL_VEHICLE_CONSUMPTIONS,
  INITIAL_EVERYDAY_EXPENSES,
  INITIAL_FOOD_ALLOWANCES,
} from './mockData.js';

const STORAGE_KEY = 'petroflow_db_prod';

class DataStore {
  constructor() {
    this.listeners = new Set();
    this.isLoading = false;
    this.isLiveConnected = false;
    this.lastError = null;

    // 1. Instantly load persistent local cache so UI is immediate on refresh
    this.loadLocalState();

    // 2. If Supabase configured, perform background sync with cloud PostgreSQL
    if (isSupabaseConfigured && supabase) {
      this.fetchFromSupabase();
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error('DataStore listener error:', e);
      }
    });
  }

  assertManager(currentUser) {
    if (!currentUser || currentUser.role !== 'manager') {
      throw new Error('Access Denied: This administrative action is strictly restricted to Operations Managers.');
    }
  }

  loadLocalState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const rawProfiles = parsed.profiles || INITIAL_PROFILES;
        this.profiles = rawProfiles.filter((p) => p.id !== 'usr-stf-1' && p.email !== 'driver.suresh@texol.com');
        if (this.profiles.length === 0) {
          this.profiles = [...INITIAL_PROFILES];
        }
        this.routes = parsed.routes || INITIAL_ROUTES;
        this.customers = parsed.customers || INITIAL_CUSTOMERS;
        this.stations = parsed.stations || INITIAL_STATIONS;
        this.products = parsed.products || INITIAL_PRODUCTS;
        this.staffRouteAssignments = parsed.staffRouteAssignments || INITIAL_STAFF_ROUTE_ASSIGNMENTS;
        this.staffStationAssignments = parsed.staffStationAssignments || INITIAL_STAFF_STATION_ASSIGNMENTS;
        this.deliveries = parsed.deliveries || INITIAL_DELIVERIES;
        this.advances = parsed.advances || INITIAL_ADVANCES;
        this.transactions = parsed.transactions || INITIAL_TRANSACTIONS;
        this.vehicles = parsed.vehicles || INITIAL_VEHICLES;
        this.factoryIntakes = parsed.factoryIntakes || INITIAL_FACTORY_INTAKES;
        this.vehicleConsumptions = parsed.vehicleConsumptions || INITIAL_VEHICLE_CONSUMPTIONS;
        this.everydayExpenses = parsed.everydayExpenses || INITIAL_EVERYDAY_EXPENSES;
        this.foodAllowances = parsed.foodAllowances || INITIAL_FOOD_ALLOWANCES;
        this.staffPasswords = parsed.staffPasswords || {};
        this.financialSummaries = parsed.financialSummaries || [];
        return;
      }
    } catch (e) {
      console.warn('Failed to parse persistent local state:', e);
    }

    // Default clean slate
    this.profiles = [...INITIAL_PROFILES];
    this.routes = [...INITIAL_ROUTES];
    this.customers = [...INITIAL_CUSTOMERS];
    this.stations = [...INITIAL_STATIONS];
    this.products = [...INITIAL_PRODUCTS];
    this.staffRouteAssignments = [...INITIAL_STAFF_ROUTE_ASSIGNMENTS];
    this.staffStationAssignments = [...INITIAL_STAFF_STATION_ASSIGNMENTS];
    this.deliveries = [...INITIAL_DELIVERIES];
    this.advances = [...INITIAL_ADVANCES];
    this.transactions = [...INITIAL_TRANSACTIONS];
    this.vehicles = [...INITIAL_VEHICLES];
    this.factoryIntakes = [...INITIAL_FACTORY_INTAKES];
    this.vehicleConsumptions = [...INITIAL_VEHICLE_CONSUMPTIONS];
    this.everydayExpenses = [...INITIAL_EVERYDAY_EXPENSES];
    this.foodAllowances = [...INITIAL_FOOD_ALLOWANCES];
    this.staffPasswords = {};
    this.financialSummaries = [];
  }

  saveLocalState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          profiles: this.profiles,
          routes: this.routes,
          customers: this.customers,
          stations: this.stations,
          products: this.products,
          staffRouteAssignments: this.staffRouteAssignments,
          staffStationAssignments: this.staffStationAssignments,
          deliveries: this.deliveries,
          advances: this.advances,
          transactions: this.transactions,
          vehicles: this.vehicles,
          factoryIntakes: this.factoryIntakes,
          vehicleConsumptions: this.vehicleConsumptions,
          everydayExpenses: this.everydayExpenses,
          foodAllowances: this.foodAllowances,
          staffPasswords: this.staffPasswords,
          financialSummaries: this.financialSummaries,
        })
      );
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }

  resetToDefaults() {
    this.profiles = [...INITIAL_PROFILES];
    this.routes = [];
    this.customers = [];
    this.stations = [];
    this.products = [...INITIAL_PRODUCTS];
    this.staffRouteAssignments = [];
    this.staffStationAssignments = [];
    this.deliveries = [];
    this.advances = [];
    this.transactions = [];
    this.vehicles = [];
    this.factoryIntakes = [];
    this.vehicleConsumptions = [];
    this.everydayExpenses = [];
    this.foodAllowances = [];
    this.staffPasswords = {};
    this.financialSummaries = [];
    this.saveLocalState();
    this.notify();
    if (isSupabaseConfigured && supabase) {
      this.fetchFromSupabase();
    }
  }

  // =========================================================================
  // SUPABASE ASYNC SYNC ENGINE
  // =========================================================================

  async fetchFromSupabase() {
    if (!isSupabaseConfigured || !supabase) return;
    this.isLoading = true;
    try {
      const [
        { data: routes },
        { data: customers },
        { data: stations },
        { data: products },
        { data: deliveries },
        { data: advances },
        { data: transactions },
        { data: profiles },
        { data: staffRoutes },
        { data: staffStations },
        { data: summaries },
      ] = await Promise.all([
        supabase.from('distribution_routes').select('*').order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.from('fuel_stations').select('*').order('created_at', { ascending: false }),
        supabase.from('fuel_products').select('*').order('created_at', { ascending: false }),
        supabase.from('fuel_deliveries').select('*').order('delivery_date', { ascending: false }),
        supabase.from('customer_advances').select('*').order('requested_at', { ascending: false }),
        supabase.from('customer_financial_transactions').select('*').order('transaction_date', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('staff_route_assignments').select('*'),
        supabase.from('staff_station_assignments').select('*'),
        supabase.from('customer_financial_summary_v').select('*'),
      ]);

      if (routes !== null && routes !== undefined) this.routes = routes;
      if (customers !== null && customers !== undefined) {
        this.customers = customers.map((remoteCust) => {
          const existing = this.customers.find((c) => c.id === remoteCust.id || c.customer_code === remoteCust.customer_code);
          const gst = remoteCust.gst_number || remoteCust.gstin || existing?.gst_number || existing?.gstin || '';
          return {
            ...remoteCust,
            gst_number: gst,
            gstin: gst,
          };
        });
      }
      if (stations !== null && stations !== undefined) this.stations = stations;
      if (products !== null && products !== undefined) this.products = products;
      if (deliveries !== null && deliveries !== undefined) this.deliveries = deliveries;
      if (advances !== null && advances !== undefined) this.advances = advances;
      if (transactions !== null && transactions !== undefined) this.transactions = transactions;
      if (staffRoutes !== null && staffRoutes !== undefined) this.staffRouteAssignments = staffRoutes || [];
      if (profiles !== null && profiles !== undefined && profiles.length > 0) {
        const profileMap = new Map();
        INITIAL_PROFILES.forEach((p) => profileMap.set(p.email.toLowerCase(), p));
        profiles.forEach((p) => profileMap.set(p.email.toLowerCase(), p));
        this.profiles = Array.from(profileMap.values());
      }
      if (staffStations !== null && staffStations !== undefined) this.staffStationAssignments = staffStations || [];
      if (summaries !== null && summaries !== undefined) this.financialSummaries = summaries || [];

      // Optional sync for new extended tables (if migrated in Supabase)
      try {
        const { data: vData } = await supabase.from('vehicles').select('*');
        if (vData) this.vehicles = vData;
      } catch (_) {}

      try {
        const { data: fiData } = await supabase.from('factory_fuel_intakes').select('*');
        if (fiData) this.factoryIntakes = fiData;
      } catch (_) {}

      try {
        const { data: vcData } = await supabase.from('vehicle_fuel_consumptions').select('*');
        if (vcData) this.vehicleConsumptions = vcData;
      } catch (_) {}

      try {
        const { data: eeData } = await supabase.from('everyday_expenses').select('*');
        if (eeData) this.everydayExpenses = eeData;
      } catch (_) {}

      try {
        const { data: faData } = await supabase.from('staff_food_allowances').select('*');
        if (faData) this.foodAllowances = faData;
      } catch (_) {}

      this.isLiveConnected = true;
      this.saveLocalState();
    } catch (err) {
      console.error('Supabase query error:', err);
      this.lastError = err.message;
    } finally {
      this.isLoading = false;
      this.notify();
    }
  }

  // =========================================================================
  // ROW LEVEL SECURITY (RLS) FILTER ENGINE
  // =========================================================================

  getAssignedRouteIds(staffId) {
    return this.staffRouteAssignments
      .filter((a) => a.staff_id === staffId)
      .map((a) => a.route_id);
  }

  getAssignedStationIds(staffId) {
    const directStationIds = this.staffStationAssignments
      .filter((a) => a.staff_id === staffId)
      .map((a) => a.station_id);

    const routeIds = this.getAssignedRouteIds(staffId);
    const inheritedStationIds = this.stations
      .filter((s) => routeIds.includes(s.route_id))
      .map((s) => s.id);

    return [...new Set([...directStationIds, ...inheritedStationIds])];
  }

  getFilteredData(currentUser) {
    const isManager = !currentUser || currentUser.role === 'manager';

    if (isManager) {
      return {
        routes: this.routes,
        stations: this.stations,
        customers: this.customers,
        products: this.products,
        deliveries: this.deliveries,
        advances: this.advances,
        transactions: this.transactions,
        vehicles: this.vehicles,
        factoryIntakes: this.factoryIntakes,
        vehicleConsumptions: this.vehicleConsumptions,
        everydayExpenses: this.everydayExpenses,
        foodAllowances: this.foodAllowances,
        staffRouteAssignments: this.staffRouteAssignments,
        staffStationAssignments: this.staffStationAssignments,
        profiles: this.profiles,
        isManager: true,
      };
    }

    // STRICT STAFF ISOLATION:
    // Only assigned staff can see the distribution route and fuel station details!
    const assignedRouteIds = this.getAssignedRouteIds(currentUser.id);
    const assignedStationIds = this.getAssignedStationIds(currentUser.id);

    // Strictly isolated: NO fallback data leaking to staff
    const filteredRoutes = this.routes.filter((r) => assignedRouteIds.includes(r.id));
    const filteredStations = this.stations.filter((s) => assignedStationIds.includes(s.id));
    
    // Customers operating assigned stations
    const customerIds = [...new Set(filteredStations.map((s) => s.customer_id))];
    const filteredCustomers = this.customers.filter((c) => customerIds.includes(c.id));

    // Deliveries for assigned stations or driver
    const filteredDeliveries = this.deliveries.filter((d) => 
      assignedStationIds.includes(d.station_id) ||
      (d.driver_name && d.driver_name.toLowerCase().includes((currentUser.full_name || '').toLowerCase()))
    );

    // Advances for assigned customers
    const filteredAdvances = this.advances.filter((a) => customerIds.includes(a.customer_id));

    // Transactions for assigned stations or customers
    const filteredTransactions = this.transactions.filter(
      (t) => (t.station_id && assignedStationIds.includes(t.station_id)) || customerIds.includes(t.customer_id)
    );

    const filteredVehicles = this.vehicles.filter((v) => v.assigned_driver_id === currentUser.id);
    const filteredFactoryIntakes = this.factoryIntakes.filter((f) => f.created_by === currentUser.id || f.driver_name === currentUser.full_name);
    const filteredConsumptions = this.vehicleConsumptions.filter((c) => c.created_by === currentUser.id || c.driver_name === currentUser.full_name);
    const filteredExpenses = this.everydayExpenses.filter((e) => e.spent_by_staff_id === currentUser.id);
    const filteredAllowances = this.foodAllowances.filter((f) => f.staff_id === currentUser.id);

    return {
      routes: filteredRoutes,
      stations: filteredStations,
      customers: filteredCustomers,
      products: this.products.filter((p) => p.is_active),
      deliveries: filteredDeliveries,
      advances: filteredAdvances,
      transactions: filteredTransactions,
      vehicles: filteredVehicles,
      factoryIntakes: filteredFactoryIntakes,
      vehicleConsumptions: filteredConsumptions,
      everydayExpenses: filteredExpenses,
      foodAllowances: filteredAllowances,
      staffRouteAssignments: this.staffRouteAssignments.filter((a) => a.staff_id === currentUser.id),
      staffStationAssignments: this.staffStationAssignments.filter((a) => a.staff_id === currentUser.id),
      profiles: this.profiles,
      isManager: false,
    };
  }

  // Dynamic View calculation: customer_financial_summary_v
  getCustomerFinancialSummaries() {
    return this.customers.map((c) => {
      const viewRecord = this.financialSummaries.find((s) => s.customer_id === c.id);
      if (viewRecord) {
        return {
          customer_id: c.id,
          customer_code: c.customer_code,
          customer_name: c.name,
          company_name: c.company_name,
          credit_limit: Number(c.credit_limit || 0),
          total_debits: Number(viewRecord.total_debits || 0),
          total_credits: Number(viewRecord.total_credits || 0),
          current_outstanding_balance: Number(viewRecord.current_outstanding_balance || 0),
          remaining_credit: Number(viewRecord.remaining_credit || 0),
          total_transactions_count: Number(viewRecord.total_transactions_count || 0),
          last_transaction_at: viewRecord.last_transaction_at,
        };
      }

      const customerTxns = this.transactions.filter((t) => t.customer_id === c.id);
      const totalDebits = customerTxns
        .filter((t) => t.entry_type === 'debit')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const totalCredits = customerTxns
        .filter((t) => t.entry_type === 'credit')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const currentBalance = totalDebits - totalCredits;
      const remainingCredit = Number(c.credit_limit || 0) - currentBalance;

      const lastTxn = customerTxns.sort(
        (a, b) => new Date(b.transaction_date) - new Date(a.transaction_date)
      )[0];

      return {
        customer_id: c.id,
        customer_code: c.customer_code,
        customer_name: c.name,
        company_name: c.company_name,
        credit_limit: Number(c.credit_limit || 0),
        total_debits: totalDebits,
        total_credits: totalCredits,
        current_outstanding_balance: currentBalance,
        remaining_credit: remainingCredit,
        total_transactions_count: customerTxns.length,
        last_transaction_at: lastTxn ? lastTxn.transaction_date : null,
      };
    });
  }

  // =========================================================================
  // ACTIONS & BUSINESS MUTATIONS
  // =========================================================================

  // 1. Record Fuel Delivery (Staff or Manager)
  async recordFuelDelivery(data, currentUser) {
    const product = this.products.find((p) => p.id === data.fuel_product_id);
    const unitPrice = data.unit_price !== undefined ? Number(data.unit_price) : Number(product?.current_unit_price || 0);
    const quantity = Number(data.quantity_liters);
    const totalAmount = quantity * unitPrice;
    const deliveryNumber = `DEL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
      100 + Math.random() * 900
    )}`;

    const deliveryId = 'del-' + Date.now();
    const newDelivery = {
      id: deliveryId,
      delivery_number: deliveryNumber,
      delivery_date: new Date().toISOString(),
      route_id: data.route_id,
      station_id: data.station_id,
      customer_id: data.customer_id,
      fuel_product_id: data.fuel_product_id,
      quantity_liters: quantity,
      unit_price: unitPrice,
      total_amount: totalAmount,
      status: 'delivered',
      truck_plate_number: data.truck_plate_number || '',
      driver_name: data.driver_name || currentUser?.full_name || 'Driver',
      meter_start: data.meter_start ? Number(data.meter_start) : null,
      meter_end: data.meter_end ? Number(data.meter_end) : null,
      notes: data.notes || '',
    };

    const newTxn = {
      id: 'txn-' + Date.now(),
      transaction_number: `TXN-DEL-${deliveryId.slice(-6).toUpperCase()}`,
      transaction_date: newDelivery.delivery_date,
      customer_id: newDelivery.customer_id,
      station_id: newDelivery.station_id,
      transaction_type: 'fuel_delivery_charge',
      entry_type: 'debit',
      amount: totalAmount,
      fuel_delivery_id: deliveryId,
      advance_id: null,
      description: `Fuel Delivery Charge: ${quantity}L @ ₹${unitPrice.toFixed(2)} (${deliveryNumber})`,
      recorded_by: currentUser?.id || null,
      created_at: new Date().toISOString(),
    };

    // Optimistic persistent update
    this.deliveries.unshift(newDelivery);
    this.transactions.unshift(newTxn);
    this.saveLocalState();
    this.notify();

    // Cloud sync with Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: record } = await supabase
          .from('fuel_deliveries')
          .insert([
            {
              delivery_number: deliveryNumber,
              delivery_date: newDelivery.delivery_date,
              route_id: data.route_id,
              station_id: data.station_id,
              customer_id: data.customer_id,
              fuel_product_id: data.fuel_product_id,
              quantity_liters: quantity,
              unit_price: unitPrice,
              status: 'delivered',
              truck_plate_number: data.truck_plate_number || '',
              driver_name: data.driver_name || currentUser?.full_name || 'Driver',
              notes: data.notes || '',
            },
          ])
          .select()
          .single();

        if (record) {
          await this.fetchFromSupabase();
          return record;
        }
      } catch (err) {
        console.warn('Supabase delivery sync caught:', err.message);
      }
    }

    return newDelivery;
  }

  // 2. Request Customer Advance (Staff or Manager)
  // Advance amount remains strictly PENDING and does NOT update customer balance until confirmed by Manager!
  async requestAdvance(arg1, arg2, arg3, arg4, arg5) {
    let data, currentUser;
    if (typeof arg1 === 'object' && arg1 !== null) {
      data = arg1;
      currentUser = arg2;
    } else {
      data = {
        customer_id: arg1,
        amount: arg2,
        payment_method: arg3 || 'bank_transfer',
        request_notes: arg4 || '',
      };
      currentUser = arg5;
    }

    const advanceNumber = `ADV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const advanceId = 'adv-' + Date.now();
    const newAdvance = {
      id: advanceId,
      advance_number: advanceNumber,
      customer_id: data.customer_id,
      station_id: data.station_id || null,
      amount: Number(data.amount),
      payment_method: data.payment_method || 'bank_transfer',
      reference_document: data.reference_document || '',
      status: 'pending', // Strictly pending!
      request_notes: data.request_notes || '',
      requested_by: currentUser?.id || null,
      requested_at: new Date().toISOString(),
      reviewed_by: null,
      reviewed_at: null,
      manager_notes: null,
      rejection_reason: null,
      created_at: new Date().toISOString(),
    };

    // Optimistic local save
    this.advances.unshift(newAdvance);
    this.saveLocalState();
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: record } = await supabase
          .from('customer_advances')
          .insert([
            {
              advance_number: advanceNumber,
              customer_id: data.customer_id,
              station_id: data.station_id || null,
              amount: Number(data.amount),
              payment_method: data.payment_method || 'bank_transfer',
              reference_document: data.reference_document || '',
              status: 'pending',
              request_notes: data.request_notes || '',
            },
          ])
          .select()
          .single();

        if (record) {
          await this.fetchFromSupabase();
          return record;
        }
      } catch (err) {
        console.warn('Supabase advance sync error:', err.message);
      }
    }

    return newAdvance;
  }

  // 3. Manager Confirmation & Approval of Advance (MANAGER ONLY)
  // Advance amount is added to customer balance ONLY upon this confirmation!
  async approveAdvance(advanceId, managerNotes, currentUser) {
    const user = (currentUser || (managerNotes && typeof managerNotes === 'object' && managerNotes.role ? managerNotes : null));
    const notes = typeof managerNotes === 'string' ? managerNotes : 'Confirmed & Approved by Manager';
    this.assertManager(user);

    const advance = this.advances.find((a) => a.id === advanceId);
    if (!advance) throw new Error('Advance request not found.');

    advance.status = 'approved';
    advance.reviewed_by = user?.id || 'mgr';
    advance.reviewed_at = new Date().toISOString();
    advance.manager_notes = notes;

    // Direct balance deduction on customer ledger upon manager approval
    const customer = this.customers.find((c) => c.id === advance.customer_id);
    if (customer) {
      customer.outstanding_balance = (customer.outstanding_balance || 0) - Number(advance.amount);
    }

    // Post to financial ledger now that manager has approved
    const newTxn = {
      id: 'txn-' + Date.now(),
      transaction_number: `TXN-ADV-${advanceId.slice(-6).toUpperCase()}`,
      transaction_date: advance.reviewed_at,
      customer_id: advance.customer_id,
      station_id: advance.station_id,
      transaction_type: 'approved_advance',
      entry_type: 'credit',
      amount: Number(advance.amount),
      fuel_delivery_id: null,
      advance_id: advance.id,
      description: `Confirmed Customer Advance Ref: ${advance.advance_number} (${advance.payment_method})`,
      recorded_by: user?.id || null,
      created_at: new Date().toISOString(),
    };

    this.transactions.unshift(newTxn);
    this.saveLocalState();
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('customer_advances')
          .update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            manager_notes: notes,
          })
          .eq('id', advanceId);

        if (customer) {
          await supabase
            .from('customers')
            .update({ outstanding_balance: customer.outstanding_balance })
            .eq('id', customer.id);
        }
      } catch (err) {
        console.warn('Supabase advance approve caught:', err.message);
      }
    }

    return advance;
  }

  // 4. Manager Rejection of Advance (MANAGER ONLY)
  async rejectAdvance(advanceId, rejectionReason, currentUser) {
    const user = (currentUser || (rejectionReason && typeof rejectionReason === 'object' && rejectionReason.role ? rejectionReason : null));
    const reason = typeof rejectionReason === 'string' ? rejectionReason : 'Rejected by Manager';
    this.assertManager(user);

    const advance = this.advances.find((a) => a.id === advanceId);
    if (!advance) throw new Error('Advance request not found.');

    advance.status = 'rejected';
    advance.reviewed_by = user?.id || 'mgr';
    advance.reviewed_at = new Date().toISOString();
    advance.rejection_reason = reason;
    advance.manager_notes = reason;

    this.saveLocalState();
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('customer_advances')
          .update({
            status: 'rejected',
            reviewed_at: new Date().toISOString(),
            rejection_reason: reason,
          })
          .eq('id', advanceId);
      } catch (err) {
        console.warn('Supabase advance reject caught:', err.message);
      }
    }

    return advance;
  }

  // 5. Record Customer Payment (Staff or Manager)
  async recordCustomerPayment(arg1, arg2, arg3, arg4, arg5) {
    let customerId, amount, paymentMethod, notes, currentUser;
    if (typeof arg1 === 'object' && arg1 !== null) {
      customerId = arg1.customerId || arg1.customer_id;
      amount = arg1.amount;
      paymentMethod = arg1.paymentMethod || arg1.payment_method;
      notes = arg1.notes || arg1.referenceNumber || arg1.reference_number;
      currentUser = arg2;
    } else {
      customerId = arg1;
      amount = arg2;
      paymentMethod = arg3;
      notes = arg4;
      currentUser = arg5;
    }

    const customer = this.customers.find((c) => c.id === customerId);
    if (!customer) throw new Error('Customer account not found.');

    customer.outstanding_balance = (customer.outstanding_balance || 0) - Number(amount);

    const newTxn = {
      id: 'txn-' + Date.now(),
      transaction_number: `TXN-PAY-${Date.now().toString().slice(-6)}`,
      transaction_date: new Date().toISOString(),
      customer_id: customerId,
      station_id: null,
      transaction_type: 'payment',
      entry_type: 'credit',
      amount: Number(amount),
      fuel_delivery_id: null,
      advance_id: null,
      description: `Customer Payment Received (${paymentMethod || 'Bank Wire'})${notes ? ': ' + notes : ''}`,
      recorded_by: currentUser?.id || null,
      created_at: new Date().toISOString(),
    };

    this.transactions.unshift(newTxn);
    this.saveLocalState();
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('customer_financial_transactions').insert([
          {
            transaction_number: newTxn.transaction_number,
            transaction_date: newTxn.transaction_date,
            customer_id: customerId,
            transaction_type: 'payment',
            entry_type: 'credit',
            amount: Number(amount),
            description: newTxn.description,
          },
        ]);
        await supabase
          .from('customers')
          .update({ outstanding_balance: customer.outstanding_balance })
          .eq('id', customer.id);
      } catch (err) {
        console.warn('Supabase payment sync warning:', err.message);
      }
    }

    return newTxn;
  }

  // 6. Record Fuel Filled From Factory (Staff or Manager + Invoice Upload)
  async recordFactoryFuelIntake(data, currentUser) {
    const intakeId = 'fintake-' + Date.now();
    const intakeNumber = `FAC-IN-${Date.now().toString().slice(-6)}`;
    const quantity = Number(data.quantity_liters);
    const unitCost = Number(data.unit_cost || 0);
    const totalCost = quantity * unitCost;

    const newIntake = {
      id: intakeId,
      intake_number: intakeNumber,
      factory_name: data.factory_name || '',
      vehicle_id: data.vehicle_id || null,
      truck_plate_number: data.truck_plate_number || '',
      driver_name: data.driver_name || currentUser?.full_name || '',
      fuel_product_id: data.fuel_product_id || null,
      fuel_name: data.fuel_name || 'Fuel',
      quantity_liters: quantity,
      unit_cost: unitCost,
      total_cost: totalCost,
      invoice_filename: data.invoice_filename || '',
      invoice_url: data.invoice_url || '', // Base64 document/invoice preview
      intake_date: data.intake_date || new Date().toISOString(),
      notes: data.notes || '',
      recorded_by: currentUser?.id || null,
      created_at: new Date().toISOString(),
    };

    this.factoryIntakes.unshift(newIntake);
    this.saveLocalState();
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('factory_fuel_intakes').insert([
          {
            intake_number: intakeNumber,
            factory_name: newIntake.factory_name,
            truck_plate_number: newIntake.truck_plate_number,
            driver_name: newIntake.driver_name,
            fuel_name: newIntake.fuel_name,
            quantity_liters: quantity,
            unit_cost: unitCost,
            total_cost: totalCost,
            invoice_filename: newIntake.invoice_filename,
            invoice_url: newIntake.invoice_url,
            notes: newIntake.notes,
          },
        ]);
      } catch (err) {
        console.warn('Supabase factory intake sync warning:', err.message);
      }
    }

    return newIntake;
  }

  // 7. Record Fuel Used by Company Vehicle (Staff or Manager)
  async recordVehicleConsumption(data, currentUser) {
    const logId = 'vcons-' + Date.now();
    const logNumber = `VLOG-${Date.now().toString().slice(-6)}`;

    const newLog = {
      id: logId,
      log_number: logNumber,
      vehicle_id: data.vehicle_id || null,
      truck_plate_number: data.truck_plate_number || '',
      driver_name: data.driver_name || currentUser?.full_name || '',
      fuel_liters: Number(data.fuel_liters),
      odometer_km: data.odometer_km ? Number(data.odometer_km) : null,
      purpose: data.purpose || '',
      logged_date: data.logged_date || new Date().toISOString(),
      recorded_by: currentUser?.id || null,
      created_at: new Date().toISOString(),
    };

    this.vehicleConsumptions.unshift(newLog);
    this.saveLocalState();
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('vehicle_fuel_consumptions').insert([
          {
            log_number: logNumber,
            truck_plate_number: newLog.truck_plate_number,
            driver_name: newLog.driver_name,
            fuel_liters: newLog.fuel_liters,
            odometer_km: newLog.odometer_km,
            purpose: newLog.purpose,
          },
        ]);
      } catch (err) {
        console.warn('Supabase vehicle consumption sync warning:', err.message);
      }
    }

    return newLog;
  }

  // 8. Record Everyday Operational Expense (Staff or Manager)
  async recordEverydayExpense(data, currentUser) {
    const expenseId = 'exp-' + Date.now();
    const expenseNumber = `EXP-${Date.now().toString().slice(-6)}`;

    const newExpense = {
      id: expenseId,
      expense_number: expenseNumber,
      category: data.category || 'Food & Meals',
      amount: Number(data.amount),
      spent_by_staff_id: currentUser?.id || null,
      spent_by_name: data.spent_by_name || currentUser?.full_name || 'Staff Operator',
      station_id: data.station_id || null,
      date: data.date || new Date().toISOString(),
      notes: data.notes || '',
      receipt_filename: data.receipt_filename || '',
      receipt_url: data.receipt_url || '',
      status: currentUser?.role === 'manager' ? 'approved' : 'logged',
      approved_by: currentUser?.role === 'manager' ? currentUser.id : null,
      created_at: new Date().toISOString(),
    };

    this.everydayExpenses.unshift(newExpense);
    this.saveLocalState();
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('everyday_expenses').insert([
          {
            expense_number: expenseNumber,
            category: newExpense.category,
            amount: newExpense.amount,
            spent_by_name: newExpense.spent_by_name,
            notes: newExpense.notes,
            receipt_filename: newExpense.receipt_filename,
            receipt_url: newExpense.receipt_url,
            status: newExpense.status,
          },
        ]);
      } catch (err) {
        console.warn('Supabase expense sync warning:', err.message);
      }
    }

    return newExpense;
  }

  // 9. Approve Expense (MANAGER ONLY)
  async approveExpense(expenseId, currentUser) {
    this.assertManager(currentUser);
    const exp = this.everydayExpenses.find((e) => e.id === expenseId);
    if (exp) {
      exp.status = 'approved';
      exp.approved_by = currentUser?.id || 'mgr';
      this.saveLocalState();
      this.notify();
    }
  }

  // =========================================================================
  // MANAGER ONLY ACTIONS: STAFF, VEHICLES, CUSTOMERS, PASSWORDS, ALLOWANCES
  // =========================================================================

  // 10. Add Customer (MANAGER ONLY)
  async createCustomer(customerData, currentUser) {
    this.assertManager(currentUser);

    const code = (customerData.customer_code || customerData.code || ('CUST-' + Math.floor(1000 + Math.random() * 9000))).trim().toUpperCase();
    const gst = (customerData.gst_number || customerData.gstin || '').trim().toUpperCase();
    const newCust = {
      id: 'cust-' + Date.now(),
      customer_code: code,
      name: customerData.name.trim(),
      company_name: customerData.company_name?.trim() || customerData.name.trim(),
      gst_number: gst,
      gstin: gst,
      email: customerData.email?.trim() || '',
      phone: customerData.phone?.trim() || '',
      billing_address: customerData.billing_address?.trim() || '',
      credit_limit: Number(customerData.credit_limit || 0),
      is_active: true,
    };

    this.customers.unshift(newCust);
    this.saveLocalState();
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        const insertPayload = {
          customer_code: newCust.customer_code,
          name: newCust.name,
          company_name: newCust.company_name,
          email: newCust.email || null,
          phone: newCust.phone || null,
          billing_address: newCust.billing_address || '',
          credit_limit: newCust.credit_limit,
          is_active: true,
        };

        let result = await supabase.from('customers').insert([{ ...insertPayload, gst_number: gst }]).select().single();
        if (result.error && (result.error.message?.includes('gst_number') || result.error.code === 'PGRST204')) {
          result = await supabase.from('customers').insert([insertPayload]).select().single();
        }

        if (result.data) {
          const idx = this.customers.findIndex((c) => c.customer_code === result.data.customer_code);
          if (idx !== -1) {
            this.customers[idx] = { ...result.data, gst_number: gst, gstin: gst };
            this.saveLocalState();
            this.notify();
          }
          await this.fetchFromSupabase();
          return this.customers[idx] || result.data;
        }
      } catch (err) {
        console.warn('Supabase createCustomer caught:', err.message);
      }
    }

    return newCust;
  }

  // Update Customer (MANAGER ONLY)
  async updateCustomer(customerId, customerData, currentUser) {
    this.assertManager(currentUser);
    const idx = this.customers.findIndex((c) => c.id === customerId);
    if (idx === -1) throw new Error('Customer not found');

    const existing = this.customers[idx];
    const gst = (customerData.gst_number !== undefined ? customerData.gst_number : (customerData.gstin !== undefined ? customerData.gstin : (existing.gst_number || existing.gstin || ''))).trim().toUpperCase();

    const updated = {
      ...existing,
      customer_code: customerData.customer_code ? customerData.customer_code.trim().toUpperCase() : existing.customer_code,
      name: customerData.name ? customerData.name.trim() : existing.name,
      company_name: customerData.company_name !== undefined ? customerData.company_name.trim() : existing.company_name,
      gst_number: gst,
      gstin: gst,
      email: customerData.email !== undefined ? customerData.email.trim() : existing.email,
      phone: customerData.phone !== undefined ? customerData.phone.trim() : existing.phone,
      billing_address: customerData.billing_address !== undefined ? customerData.billing_address.trim() : existing.billing_address,
      credit_limit: customerData.credit_limit !== undefined ? Number(customerData.credit_limit) : existing.credit_limit,
    };

    this.customers[idx] = updated;
    this.saveLocalState();
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        const payload = {
          customer_code: updated.customer_code,
          name: updated.name,
          company_name: updated.company_name,
          email: updated.email || null,
          phone: updated.phone || null,
          billing_address: updated.billing_address || '',
          credit_limit: updated.credit_limit,
        };
        let res = await supabase.from('customers').update({ ...payload, gst_number: gst }).eq('id', customerId).select().single();
        if (res.error && (res.error.message?.includes('gst_number') || res.error.code === 'PGRST204')) {
          res = await supabase.from('customers').update(payload).eq('id', customerId).select().single();
        }
        if (res.data) {
          this.customers[idx] = { ...res.data, gst_number: gst, gstin: gst };
          this.saveLocalState();
          this.notify();
        }
      } catch (err) {
        console.warn('Supabase updateCustomer caught:', err.message);
      }
    }

    return updated;
  }

  // Delete Customer (MANAGER ONLY)
  async deleteCustomer(customerId, currentUser) {
    this.assertManager(currentUser);
    const cust = this.customers.find((c) => c.id === customerId);
    if (!cust) throw new Error('Customer not found');

    const linkedStations = this.stations.filter((s) => s.customer_id === customerId);
    if (linkedStations.length > 0) {
      throw new Error(`Cannot delete customer "${cust.name}": ${linkedStations.length} dispensing station(s) (${linkedStations.map(s => s.name).join(', ')}) are linked to this customer account. Please reassign or delete these stations first.`);
    }

    const linkedDeliveries = this.deliveries.filter((d) => d.customer_id === customerId);
    if (linkedDeliveries.length > 0) {
      throw new Error(`Cannot delete customer "${cust.name}": ${linkedDeliveries.length} delivery manifest(s) are recorded under this account.`);
    }

    const linkedTxns = this.transactions.filter((t) => t.customer_id === customerId);
    if (linkedTxns.length > 0) {
      throw new Error(`Cannot delete customer "${cust.name}": ${linkedTxns.length} financial transaction(s) are recorded on the customer ledger.`);
    }

    const linkedAdvances = this.advances.filter((a) => a.customer_id === customerId);
    if (linkedAdvances.length > 0) {
      throw new Error(`Cannot delete customer "${cust.name}": ${linkedAdvances.length} advance record(s) exist for this account.`);
    }

    this.customers = this.customers.filter((c) => c.id !== customerId);
    this.saveLocalState();
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('customers').delete().eq('id', customerId);
        if (error) {
          console.warn('Supabase deleteCustomer error:', error.message);
        }
      } catch (err) {
        console.warn('Supabase deleteCustomer caught:', err.message);
      }
    }

    return true;
  }

  // 11. Add Fleet Vehicle (MANAGER ONLY)
  async createVehicle(vehicleData, currentUser) {
    this.assertManager(currentUser);

    const newVeh = {
      id: 'veh-' + Date.now(),
      plate_number: vehicleData.plate_number.trim().toUpperCase(),
      vehicle_type: vehicleData.vehicle_type || 'tanker',
      model: vehicleData.model || 'BharatBenz 2823R Rigid Tanker',
      capacity_liters: Number(vehicleData.capacity_liters || 16000),
      assigned_driver_id: vehicleData.assigned_driver_id || null,
      status: 'active',
      created_by: currentUser?.id || null,
      created_at: new Date().toISOString(),
    };

    this.vehicles.unshift(newVeh);
    this.saveLocalState();
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('vehicles').insert([
          {
            plate_number: newVeh.plate_number,
            vehicle_type: newVeh.vehicle_type,
            model: newVeh.model,
            capacity_liters: newVeh.capacity_liters,
            assigned_driver_id: newVeh.assigned_driver_id,
            status: 'active',
          },
        ]);
      } catch (err) {
        console.warn('Supabase vehicle insert warning:', err.message);
      }
    }

    return newVeh;
  }

  // 12. Assign Vehicle to Driver (MANAGER ONLY)
  async assignVehicle(vehicleId, driverId, currentUser) {
    this.assertManager(currentUser);
    const vehicle = this.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) throw new Error('Vehicle not found.');

    vehicle.assigned_driver_id = driverId || null;
    this.saveLocalState();
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('vehicles')
          .update({ assigned_driver_id: driverId || null })
          .eq('id', vehicleId);
      } catch (err) {
        console.warn('Supabase vehicle assign warning:', err.message);
      }
    }
  }

  // 13. Add Staff / Driver (MANAGER ONLY)
  async createStaff(staffData, currentUser) {
    this.assertManager(currentUser);

    const newStaff = {
      id: 'usr-stf-' + Date.now(),
      full_name: staffData.full_name.trim(),
      email: staffData.email.trim().toLowerCase(),
      phone: staffData.phone?.trim() || '',
      role: 'staff',
      is_active: true,
    };

    this.profiles.push(newStaff);
    this.saveLocalState();
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
          .from('profiles')
          .insert([
            {
              full_name: newStaff.full_name,
              email: newStaff.email,
              phone: newStaff.phone || null,
              role: 'staff',
              is_active: true,
            },
          ])
          .select()
          .single();

        if (data) {
          const idx = this.profiles.findIndex((p) => p.email === data.email);
          if (idx !== -1) {
            this.profiles[idx] = data;
            this.saveLocalState();
            this.notify();
          }
          await this.fetchFromSupabase();
          return data;
        }
      } catch (err) {
        console.warn('Supabase createStaff caught:', err.message);
      }
    }

    return newStaff;
  }

  // 14. Reset Staff Password (MANAGER ONLY)
  async resetStaffPassword(staffId, newPassword, currentUser) {
    this.assertManager(currentUser);
    const staff = this.profiles.find((p) => p.id === staffId || p.email === staffId);
    const targetId = staff ? staff.id : staffId;

    this.staffPasswords[targetId] = {
      password: newPassword,
      reset_at: new Date().toISOString(),
      reset_by: currentUser?.full_name || 'Manager',
    };

    this.saveLocalState();
    this.notify();
    return true;
  }

  // 15. Set Staff Food & Daily Allowance (MANAGER ONLY)
  async setStaffFoodAllowance(staffId, dailyFoodAmount, dailyTravelAmount, currentUser) {
    this.assertManager(currentUser);
    const existingIndex = this.foodAllowances.findIndex((f) => f.staff_id === staffId);
    const allowanceRecord = {
      id: 'fa-' + Date.now(),
      staff_id: staffId,
      daily_food_allowance: Number(dailyFoodAmount || 500),
      daily_travel_allowance: Number(dailyTravelAmount || 0),
      effective_from: new Date().toISOString().slice(0, 10),
      assigned_by: currentUser?.id || null,
    };

    if (existingIndex >= 0) {
      this.foodAllowances[existingIndex] = allowanceRecord;
    } else {
      this.foodAllowances.push(allowanceRecord);
    }

    this.saveLocalState();
    this.notify();
    return allowanceRecord;
  }

  // 16. Create Route (MANAGER ONLY)
  async createRoute(routeData, currentUser) {
    this.assertManager(currentUser);

    const newRt = {
      id: 'rt-' + Date.now(),
      route_code: routeData.route_code.trim().toUpperCase(),
      name: routeData.name.trim(),
      description: routeData.description?.trim() || '',
      is_active: true,
    };

    this.routes.unshift(newRt);
    this.saveLocalState();
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
          .from('distribution_routes')
          .insert([
            {
              route_code: newRt.route_code,
              name: newRt.name,
              description: newRt.description,
              is_active: true,
            },
          ])
          .select()
          .single();

        if (data) {
          const idx = this.routes.findIndex((r) => r.route_code === data.route_code);
          if (idx !== -1) {
            this.routes[idx] = data;
            this.saveLocalState();
            this.notify();
          }
          await this.fetchFromSupabase();
          return data;
        }
      } catch (err) {
        console.warn('Supabase createRoute caught:', err.message);
      }
    }

    return newRt;
  }

  // Update Route Corridor (MANAGER ONLY)
  async updateRoute(routeId, routeData, currentUser) {
    this.assertManager(currentUser);
    const idx = this.routes.findIndex((r) => r.id === routeId);
    if (idx === -1) throw new Error('Route corridor not found');

    const existing = this.routes[idx];
    const updated = {
      ...existing,
      route_code: routeData.route_code ? routeData.route_code.trim().toUpperCase() : existing.route_code,
      name: routeData.name ? routeData.name.trim() : existing.name,
      description: routeData.description !== undefined ? routeData.description.trim() : existing.description,
    };

    this.routes[idx] = updated;
    this.saveLocalState();
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
          .from('distribution_routes')
          .update({
            route_code: updated.route_code,
            name: updated.name,
            description: updated.description,
          })
          .eq('id', routeId)
          .select()
          .single();

        if (data) {
          this.routes[idx] = data;
          this.saveLocalState();
          this.notify();
        }
      } catch (err) {
        console.warn('Supabase updateRoute caught:', err.message);
      }
    }

    return updated;
  }

  // Delete Route Corridor (MANAGER ONLY)
  async deleteRoute(routeId, currentUser) {
    this.assertManager(currentUser);
    const rt = this.routes.find((r) => r.id === routeId);
    if (!rt) throw new Error('Route corridor not found');

    const linkedStations = this.stations.filter((s) => s.route_id === routeId);
    if (linkedStations.length > 0) {
      throw new Error(`Cannot delete route "${rt.name}": ${linkedStations.length} station(s) (${linkedStations.map(s => s.name).join(', ')}) are located along this corridor. Please reassign or delete these stations first.`);
    }

    const linkedDeliveries = this.deliveries.filter((d) => d.route_id === routeId);
    if (linkedDeliveries.length > 0) {
      throw new Error(`Cannot delete route "${rt.name}": ${linkedDeliveries.length} delivery manifest(s) are logged along this corridor.`);
    }

    this.staffRouteAssignments = this.staffRouteAssignments.filter((a) => a.route_id !== routeId);
    this.routes = this.routes.filter((r) => r.id !== routeId);
    this.saveLocalState();
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('staff_route_assignments').delete().eq('route_id', routeId);
        const { error } = await supabase.from('distribution_routes').delete().eq('id', routeId);
        if (error) {
          console.warn('Supabase deleteRoute error:', error.message);
        }
      } catch (err) {
        console.warn('Supabase deleteRoute caught:', err.message);
      }
    }

    return true;
  }

  // 17. Create Station (MANAGER ONLY)
  async createStation(stationData, currentUser) {
    this.assertManager(currentUser);

    const newStn = {
      id: 'stn-' + Date.now(),
      station_code: stationData.station_code.trim().toUpperCase(),
      name: stationData.name.trim(),
      route_id: stationData.route_id,
      customer_id: stationData.customer_id,
      address: stationData.address?.trim() || '',
      contact_person: stationData.contact_person?.trim() || '',
      contact_phone: stationData.contact_phone?.trim() || '',
      is_active: true,
    };

    this.stations.unshift(newStn);
    this.saveLocalState();
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
          .from('fuel_stations')
          .insert([
            {
              station_code: newStn.station_code,
              name: newStn.name,
              route_id: newStn.route_id,
              customer_id: newStn.customer_id,
              address: newStn.address,
              contact_person: newStn.contact_person,
              contact_phone: newStn.contact_phone,
              is_active: true,
            },
          ])
          .select()
          .single();

        if (data) {
          const idx = this.stations.findIndex((s) => s.station_code === data.station_code);
          if (idx !== -1) {
            this.stations[idx] = data;
            this.saveLocalState();
            this.notify();
          }
          await this.fetchFromSupabase();
          return data;
        }
      } catch (err) {
        console.warn('Supabase createStation caught:', err.message);
      }
    }

    return newStn;
  }

  // 18. Create Fuel Product (MANAGER ONLY)
  async createProduct(productData, currentUser) {
    this.assertManager(currentUser);

    const newProd = {
      id: 'prod-' + Date.now(),
      product_code: productData.product_code.trim().toUpperCase(),
      name: productData.name.trim(),
      current_unit_price: Number(productData.current_unit_price),
      unit_of_measure: productData.unit_of_measure || 'Liters',
      is_active: true,
    };

    this.products.unshift(newProd);
    this.saveLocalState();
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
          .from('fuel_products')
          .insert([
            {
              product_code: newProd.product_code,
              name: newProd.name,
              current_unit_price: newProd.current_unit_price,
              unit_of_measure: newProd.unit_of_measure,
              is_active: true,
            },
          ])
          .select()
          .single();

        if (data) {
          const idx = this.products.findIndex((p) => p.product_code === data.product_code);
          if (idx !== -1) {
            this.products[idx] = data;
            this.saveLocalState();
            this.notify();
          }
          await this.fetchFromSupabase();
          return data;
        }
      } catch (err) {
        console.warn('Supabase createProduct caught:', err.message);
      }
    }

    return newProd;
  }

  // 19. Staff Route Assignment (MANAGER ONLY)
  async toggleStaffRouteAssignment(staffId, routeId, currentUser) {
    this.assertManager(currentUser);

    const existingIndex = this.staffRouteAssignments.findIndex(
      (a) => a.staff_id === staffId && a.route_id === routeId
    );

    if (existingIndex >= 0) {
      this.staffRouteAssignments.splice(existingIndex, 1);
    } else {
      this.staffRouteAssignments.push({
        id: 'sra-' + Date.now(),
        staff_id: staffId,
        route_id: routeId,
        assigned_by: currentUser?.id || null,
        assigned_at: new Date().toISOString(),
      });
    }
    this.saveLocalState();
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        if (existingIndex >= 0) {
          await supabase.from('staff_route_assignments').delete().match({ staff_id: staffId, route_id: routeId });
        } else {
          await supabase.from('staff_route_assignments').insert([{ staff_id: staffId, route_id: routeId, assigned_by: currentUser?.id || null }]);
        }
        await this.fetchFromSupabase();
      } catch (err) {
        console.warn('Supabase staff route toggle caught:', err.message);
      }
    }
  }

  // 20. Staff Station Assignment (MANAGER ONLY)
  async toggleStaffStationAssignment(staffId, stationId, currentUser) {
    this.assertManager(currentUser);

    const existingIndex = this.staffStationAssignments.findIndex(
      (a) => a.staff_id === staffId && a.station_id === stationId
    );

    if (existingIndex >= 0) {
      this.staffStationAssignments.splice(existingIndex, 1);
    } else {
      this.staffStationAssignments.push({
        id: 'ssa-' + Date.now(),
        staff_id: staffId,
        station_id: stationId,
        assigned_by: currentUser?.id || null,
        assigned_at: new Date().toISOString(),
      });
    }
    this.saveLocalState();
    this.notify();

    if (isSupabaseConfigured && supabase) {
      try {
        if (existingIndex >= 0) {
          await supabase.from('staff_station_assignments').delete().match({ staff_id: staffId, station_id: stationId });
        } else {
          await supabase.from('staff_station_assignments').insert([{ staff_id: staffId, station_id: stationId, assigned_by: currentUser?.id || null }]);
        }
        await this.fetchFromSupabase();
      } catch (err) {
        console.warn('Supabase staff station toggle caught:', err.message);
      }
    }
  }
}

export const dataStore = new DataStore();
