-- ============================================================================
-- FLEET, FACTORY FUEL INTAKE, VEHICLE CONSUMPTION & EXPENSES SCHEMA
-- Extends PetroFlow for operational staff entries & manager governance
-- ============================================================================

-- 1. Fleet & Company Vehicles Master Table (Managed by Manager)
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_number TEXT NOT NULL UNIQUE,
    vehicle_type TEXT NOT NULL DEFAULT 'tanker', -- 'tanker', 'company_vehicle', 'pickup'
    model TEXT,
    capacity_liters NUMERIC(10,2) DEFAULT 0,
    assigned_driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'maintenance', 'in_transit'
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Factory Fuel Intakes (Staff can record fuel filled from refinery/factory + invoice upload)
CREATE TABLE IF NOT EXISTS public.factory_fuel_intakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intake_number TEXT NOT NULL UNIQUE,
    factory_name TEXT NOT NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    truck_plate_number TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    fuel_product_id UUID REFERENCES public.fuel_products(id) ON DELETE SET NULL,
    fuel_name TEXT NOT NULL,
    quantity_liters NUMERIC(12,2) NOT NULL CHECK (quantity_liters > 0),
    unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_cost NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    invoice_filename TEXT,
    invoice_url TEXT, -- Base64 data URL or storage bucket link
    intake_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Company Vehicle Fuel Consumptions (Staff can record internal vehicle fuel usage)
CREATE TABLE IF NOT EXISTS public.vehicle_fuel_consumptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_number TEXT NOT NULL UNIQUE,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    truck_plate_number TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    fuel_liters NUMERIC(10,2) NOT NULL CHECK (fuel_liters > 0),
    odometer_km NUMERIC(10,1),
    purpose TEXT,
    logged_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Everyday Operational Expenses (Staff can submit daily food, toll, petty cash)
CREATE TABLE IF NOT EXISTS public.everyday_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_number TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL, -- 'Food & Meals', 'Toll & Fastag', 'Vehicle Maintenance', 'Driver Daily Allowance', 'Station Miscellaneous', 'Petty Cash'
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    spent_by_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    spent_by_name TEXT NOT NULL,
    station_id UUID REFERENCES public.fuel_stations(id) ON DELETE SET NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT,
    receipt_filename TEXT,
    receipt_url TEXT,
    status TEXT NOT NULL DEFAULT 'logged', -- 'logged', 'approved', 'rejected'
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Staff Food & Daily Allowances (Configured by Manager)
CREATE TABLE IF NOT EXISTS public.staff_food_allowances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    daily_food_allowance NUMERIC(10,2) NOT NULL DEFAULT 500.00,
    daily_travel_allowance NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_staff_food_allowance UNIQUE (staff_id)
);

-- Enable RLS & Anon access policies for frontend development
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_fuel_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_fuel_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.everyday_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_food_allowances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all on vehicles" ON public.vehicles;
CREATE POLICY "Allow anon all on vehicles" ON public.vehicles FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on factory_fuel_intakes" ON public.factory_fuel_intakes;
CREATE POLICY "Allow anon all on factory_fuel_intakes" ON public.factory_fuel_intakes FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on vehicle_fuel_consumptions" ON public.vehicle_fuel_consumptions;
CREATE POLICY "Allow anon all on vehicle_fuel_consumptions" ON public.vehicle_fuel_consumptions FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on everyday_expenses" ON public.everyday_expenses;
CREATE POLICY "Allow anon all on everyday_expenses" ON public.everyday_expenses FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on staff_food_allowances" ON public.staff_food_allowances;
CREATE POLICY "Allow anon all on staff_food_allowances" ON public.staff_food_allowances FOR ALL TO anon USING (true) WITH CHECK (true);
