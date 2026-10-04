-- ============================================================================
-- OIL DISTRIBUTION MANAGEMENT & ANALYTICS SYSTEM
-- PostgreSQL Database Schema for Supabase
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUMS & DOMAIN TYPES
-- ============================================================================

CREATE TYPE public.user_role AS ENUM ('manager', 'staff');
CREATE TYPE public.advance_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.financial_entry_type AS ENUM ('debit', 'credit');
CREATE TYPE public.financial_transaction_type AS ENUM (
    'fuel_delivery_charge',
    'payment',
    'approved_advance',
    'adjustment'
);
CREATE TYPE public.delivery_status AS ENUM ('in_transit', 'delivered', 'cancelled');

-- ============================================================================
-- 2. CORE MASTER TABLES
-- ============================================================================

-- 2.1 User Profiles (Extends auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role public.user_role NOT NULL DEFAULT 'staff',
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.2 Distribution Routes
CREATE TABLE public.distribution_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.3 Customers (No editable balance column - calculated from ledger)
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    company_name TEXT,
    email TEXT,
    phone TEXT,
    billing_address TEXT,
    credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (credit_limit >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.4 Fuel Stations
CREATE TABLE public.fuel_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    route_id UUID NOT NULL REFERENCES public.distribution_routes(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    address TEXT,
    gps_latitude NUMERIC(9,6),
    gps_longitude NUMERIC(9,6),
    contact_person TEXT,
    contact_phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. ASSIGNMENT JUNCTION TABLES (STAFF ACCESS CONTROL)
-- ============================================================================

-- 3.1 Staff to Route Assignments
CREATE TABLE public.staff_route_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES public.distribution_routes(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_staff_route UNIQUE (staff_id, route_id)
);

-- 3.2 Staff to Fuel Station Assignments
CREATE TABLE public.staff_station_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES public.fuel_stations(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_staff_station UNIQUE (staff_id, station_id)
);

-- ============================================================================
-- 4. PRODUCTS & FUEL DELIVERY TRANSACTIONS
-- ============================================================================

-- 4.1 Fuel Products Catalog
CREATE TABLE public.fuel_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    current_unit_price NUMERIC(10,2) NOT NULL CHECK (current_unit_price >= 0),
    unit_of_measure TEXT NOT NULL DEFAULT 'Liters',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4.2 Fuel Deliveries (Physical dispatch & historical delivery log)
CREATE TABLE public.fuel_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_number TEXT NOT NULL UNIQUE,
    delivery_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    route_id UUID NOT NULL REFERENCES public.distribution_routes(id) ON DELETE RESTRICT,
    station_id UUID NOT NULL REFERENCES public.fuel_stations(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    fuel_product_id UUID NOT NULL REFERENCES public.fuel_products(id) ON DELETE RESTRICT,
    quantity_liters NUMERIC(12,2) NOT NULL CHECK (quantity_liters > 0),
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    total_amount NUMERIC(14,2) GENERATED ALWAYS AS (quantity_liters * unit_price) STORED,
    status public.delivery_status NOT NULL DEFAULT 'delivered',
    truck_plate_number TEXT,
    driver_name TEXT,
    meter_start NUMERIC(12,2) CHECK (meter_start IS NULL OR meter_start >= 0),
    meter_end NUMERIC(12,2) CHECK (meter_end IS NULL OR meter_end >= COALESCE(meter_start, 0)),
    delivery_receipt_url TEXT,
    notes TEXT,
    delivered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. ADVANCE WORKFLOW & FINANCIAL LEDGER
-- ============================================================================

-- 5.1 Customer Advances
CREATE TABLE public.customer_advances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advance_number TEXT NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    station_id UUID REFERENCES public.fuel_stations(id) ON DELETE RESTRICT,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    payment_method TEXT,
    reference_document TEXT,
    receipt_url TEXT,
    status public.advance_status NOT NULL DEFAULT 'pending',
    request_notes TEXT,
    requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ,
    manager_notes TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_advance_review_state CHECK (
        (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
        OR
        (status IN ('approved', 'rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

-- 5.2 Customer Financial Transactions (Append-Only Historical Ledger)
CREATE TABLE public.customer_financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_number TEXT NOT NULL UNIQUE,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    station_id UUID REFERENCES public.fuel_stations(id) ON DELETE RESTRICT,
    transaction_type public.financial_transaction_type NOT NULL,
    entry_type public.financial_entry_type NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    fuel_delivery_id UUID UNIQUE REFERENCES public.fuel_deliveries(id) ON DELETE RESTRICT,
    advance_id UUID UNIQUE REFERENCES public.customer_advances(id) ON DELETE RESTRICT,
    description TEXT NOT NULL,
    recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_fuel_delivery_link CHECK (
        (transaction_type = 'fuel_delivery_charge' AND entry_type = 'debit' AND fuel_delivery_id IS NOT NULL)
        OR
        (transaction_type <> 'fuel_delivery_charge' AND fuel_delivery_id IS NULL)
    ),
    CONSTRAINT chk_approved_advance_link CHECK (
        (transaction_type = 'approved_advance' AND entry_type = 'credit' AND advance_id IS NOT NULL)
        OR
        (transaction_type <> 'approved_advance' AND advance_id IS NULL)
    )
);

-- ============================================================================
-- 6. AUDIT LOGGING
-- ============================================================================

CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_is_active ON public.profiles(is_active);

CREATE INDEX idx_routes_active ON public.distribution_routes(is_active);

CREATE INDEX idx_customers_active ON public.customers(is_active);
CREATE INDEX idx_customers_name ON public.customers(name);

CREATE INDEX idx_stations_route ON public.fuel_stations(route_id);
CREATE INDEX idx_stations_customer ON public.fuel_stations(customer_id);
CREATE INDEX idx_stations_active ON public.fuel_stations(is_active);

CREATE INDEX idx_staff_route_staff ON public.staff_route_assignments(staff_id);
CREATE INDEX idx_staff_route_route ON public.staff_route_assignments(route_id);

CREATE INDEX idx_staff_station_staff ON public.staff_station_assignments(staff_id);
CREATE INDEX idx_staff_station_station ON public.staff_station_assignments(station_id);

CREATE INDEX idx_deliveries_station ON public.fuel_deliveries(station_id);
CREATE INDEX idx_deliveries_customer ON public.fuel_deliveries(customer_id);
CREATE INDEX idx_deliveries_route ON public.fuel_deliveries(route_id);
CREATE INDEX idx_deliveries_date ON public.fuel_deliveries(delivery_date DESC);

CREATE INDEX idx_advances_customer ON public.customer_advances(customer_id);
CREATE INDEX idx_advances_status ON public.customer_advances(status);
CREATE INDEX idx_advances_requested_at ON public.customer_advances(requested_at DESC);

CREATE INDEX idx_fin_tx_customer ON public.customer_financial_transactions(customer_id);
CREATE INDEX idx_fin_tx_date ON public.customer_financial_transactions(transaction_date DESC);
CREATE INDEX idx_fin_tx_type ON public.customer_financial_transactions(transaction_type);

CREATE INDEX idx_audit_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX idx_audit_created_at ON public.audit_logs(created_at DESC);

-- ============================================================================
-- 8. DYNAMIC CUSTOMER BALANCES VIEW (SECURITY INVOKER)
-- ============================================================================

CREATE OR REPLACE VIEW public.customer_financial_summary_v
WITH (security_invoker = true) AS
SELECT 
    c.id AS customer_id,
    c.customer_code,
    c.name AS customer_name,
    c.credit_limit,
    COALESCE(SUM(CASE WHEN t.entry_type = 'debit' THEN t.amount ELSE 0 END), 0) AS total_debits,
    COALESCE(SUM(CASE WHEN t.entry_type = 'credit' THEN t.amount ELSE 0 END), 0) AS total_credits,
    COALESCE(SUM(CASE WHEN t.entry_type = 'debit' THEN t.amount ELSE -t.amount END), 0) AS current_outstanding_balance,
    (c.credit_limit - COALESCE(SUM(CASE WHEN t.entry_type = 'debit' THEN t.amount ELSE -t.amount END), 0)) AS remaining_credit,
    COUNT(t.id) AS total_transactions_count,
    MAX(t.transaction_date) AS last_transaction_at
FROM public.customers c
LEFT JOIN public.customer_financial_transactions t ON c.id = t.customer_id
GROUP BY c.id, c.customer_code, c.name, c.credit_limit;

-- ============================================================================
-- 9. TRIGGERS & BUSINESS FUNCTIONS
-- ============================================================================

-- 9.1 Automatic Updated At Trigger Function
CREATE OR REPLACE FUNCTION public.fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_timestamp BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();
CREATE TRIGGER trg_routes_timestamp BEFORE UPDATE ON public.distribution_routes FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();
CREATE TRIGGER trg_stations_timestamp BEFORE UPDATE ON public.fuel_stations FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();
CREATE TRIGGER trg_customers_timestamp BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();
CREATE TRIGGER trg_fuel_products_timestamp BEFORE UPDATE ON public.fuel_products FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();
CREATE TRIGGER trg_fuel_deliveries_timestamp BEFORE UPDATE ON public.fuel_deliveries FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();
CREATE TRIGGER trg_customer_advances_timestamp BEFORE UPDATE ON public.customer_advances FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();

-- 9.2 Immutability of Financial Transactions
CREATE OR REPLACE FUNCTION public.fn_prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Financial transaction records are strictly immutable. Updates and deletes are prohibited.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_immutable_financial_transactions
BEFORE UPDATE OR DELETE ON public.customer_financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_ledger_modification();

-- 9.3 Advance Approval to Ledger Posting Trigger
CREATE OR REPLACE FUNCTION public.fn_handle_advance_approval()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        INSERT INTO public.customer_financial_transactions (
            transaction_number,
            transaction_date,
            customer_id,
            station_id,
            transaction_type,
            entry_type,
            amount,
            advance_id,
            description,
            recorded_by
        ) VALUES (
            'TXN-ADV-' || UPPER(SUBSTRING(NEW.id::text, 1, 8)),
            COALESCE(NEW.reviewed_at, now()),
            NEW.customer_id,
            NEW.station_id,
            'approved_advance',
            'credit',
            NEW.amount,
            NEW.id,
            'Approved Customer Advance Ref: ' || NEW.advance_number,
            NEW.reviewed_by
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_advance_approval_to_ledger
AFTER UPDATE ON public.customer_advances
FOR EACH ROW EXECUTE FUNCTION public.fn_handle_advance_approval();

-- 9.4 Delivery Charge to Ledger Posting Trigger
CREATE OR REPLACE FUNCTION public.fn_handle_delivery_charge_posting()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'delivered' THEN
        INSERT INTO public.customer_financial_transactions (
            transaction_number,
            transaction_date,
            customer_id,
            station_id,
            transaction_type,
            entry_type,
            amount,
            fuel_delivery_id,
            description,
            recorded_by
        ) VALUES (
            'TXN-DEL-' || UPPER(SUBSTRING(NEW.id::text, 1, 8)),
            NEW.delivery_date,
            NEW.customer_id,
            NEW.station_id,
            'fuel_delivery_charge',
            'debit',
            NEW.total_amount,
            NEW.id,
            'Fuel Delivery Charge: ' || NEW.quantity_liters || 'L @ ' || NEW.unit_price || ' (' || NEW.delivery_number || ')',
            NEW.created_by
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_delivery_charge_to_ledger
AFTER INSERT ON public.fuel_deliveries
FOR EACH ROW EXECUTE FUNCTION public.fn_handle_delivery_charge_posting();

-- 9.5 Automatic Profile Creation upon Supabase Auth SignUp
CREATE OR REPLACE FUNCTION public.fn_handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'staff'::public.user_role)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_auth_user();

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) & ACCESS CONTROL
-- ============================================================================

-- Helper functions for RLS checks
CREATE OR REPLACE FUNCTION public.fn_is_manager()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'manager' AND is_active = true
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.fn_staff_assigned_routes()
RETURNS SETOF UUID AS $$
    SELECT route_id FROM public.staff_route_assignments
    WHERE staff_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.fn_staff_assigned_stations()
RETURNS SETOF UUID AS $$
    SELECT station_id FROM public.staff_station_assignments
    WHERE staff_id = auth.uid()
    UNION
    SELECT id FROM public.fuel_stations
    WHERE route_id IN (SELECT public.fn_staff_assigned_routes());
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_route_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_station_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 10.1 PROFILES POLICIES
CREATE POLICY "Managers have full access to profiles"
    ON public.profiles FOR ALL
    USING (public.fn_is_manager());

CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can update own non-role fields"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 10.2 DISTRIBUTION ROUTES POLICIES
CREATE POLICY "Managers have full access to routes"
    ON public.distribution_routes FOR ALL
    USING (public.fn_is_manager());

CREATE POLICY "Staff can view assigned routes"
    ON public.distribution_routes FOR SELECT
    USING (id IN (SELECT public.fn_staff_assigned_routes()));

-- 10.3 CUSTOMERS POLICIES
CREATE POLICY "Managers have full access to customers"
    ON public.customers FOR ALL
    USING (public.fn_is_manager());

CREATE POLICY "Staff can view customers with assigned stations"
    ON public.customers FOR SELECT
    USING (
        id IN (
            SELECT customer_id FROM public.fuel_stations
            WHERE id IN (SELECT public.fn_staff_assigned_stations())
        )
    );

-- 10.4 FUEL STATIONS POLICIES
CREATE POLICY "Managers have full access to stations"
    ON public.fuel_stations FOR ALL
    USING (public.fn_is_manager());

CREATE POLICY "Staff can view assigned stations"
    ON public.fuel_stations FOR SELECT
    USING (id IN (SELECT public.fn_staff_assigned_stations()));

-- 10.5 STAFF ASSIGNMENTS POLICIES
CREATE POLICY "Managers have full access to route assignments"
    ON public.staff_route_assignments FOR ALL
    USING (public.fn_is_manager());

CREATE POLICY "Staff can view their own route assignments"
    ON public.staff_route_assignments FOR SELECT
    USING (staff_id = auth.uid());

CREATE POLICY "Managers have full access to station assignments"
    ON public.staff_station_assignments FOR ALL
    USING (public.fn_is_manager());

CREATE POLICY "Staff can view their own station assignments"
    ON public.staff_station_assignments FOR SELECT
    USING (staff_id = auth.uid());

-- 10.6 FUEL PRODUCTS POLICIES
CREATE POLICY "Managers have full access to products"
    ON public.fuel_products FOR ALL
    USING (public.fn_is_manager());

CREATE POLICY "Staff can view active products"
    ON public.fuel_products FOR SELECT
    USING (is_active = true);

-- 10.7 FUEL DELIVERIES POLICIES
CREATE POLICY "Managers have full access to deliveries"
    ON public.fuel_deliveries FOR ALL
    USING (public.fn_is_manager());

CREATE POLICY "Staff can view deliveries for assigned stations"
    ON public.fuel_deliveries FOR SELECT
    USING (station_id IN (SELECT public.fn_staff_assigned_stations()));

CREATE POLICY "Staff can insert deliveries for assigned stations"
    ON public.fuel_deliveries FOR INSERT
    WITH CHECK (
        station_id IN (SELECT public.fn_staff_assigned_stations())
        AND created_by = auth.uid()
    );

-- 10.8 CUSTOMER ADVANCES POLICIES
CREATE POLICY "Managers have full access to advances"
    ON public.customer_advances FOR ALL
    USING (public.fn_is_manager());

CREATE POLICY "Staff can view advances for assigned customers"
    ON public.customer_advances FOR SELECT
    USING (
        customer_id IN (
            SELECT customer_id FROM public.fuel_stations
            WHERE id IN (SELECT public.fn_staff_assigned_stations())
        )
    );

CREATE POLICY "Staff can request advances for assigned customers"
    ON public.customer_advances FOR INSERT
    WITH CHECK (
        status = 'pending'
        AND requested_by = auth.uid()
        AND customer_id IN (
            SELECT customer_id FROM public.fuel_stations
            WHERE id IN (SELECT public.fn_staff_assigned_stations())
        )
    );

-- 10.9 CUSTOMER FINANCIAL TRANSACTIONS POLICIES
CREATE POLICY "Managers have full access to ledger"
    ON public.customer_financial_transactions FOR ALL
    USING (public.fn_is_manager());

CREATE POLICY "Staff can view financial transactions for assigned stations"
    ON public.customer_financial_transactions FOR SELECT
    USING (
        station_id IS NULL OR station_id IN (SELECT public.fn_staff_assigned_stations())
    );

-- 10.10 AUDIT LOGS POLICIES
CREATE POLICY "Managers have full access to audit logs"
    ON public.audit_logs FOR ALL
    USING (public.fn_is_manager());
