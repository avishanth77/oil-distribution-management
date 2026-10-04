-- ============================================================================
-- PETROFLOW - DEVELOPMENT & DIRECT FRONTEND ACCESS POLICIES
-- Enables reading and inserting from frontend client using Supabase anon key
-- Run this in your Supabase SQL Editor to enable direct access from the web app
-- ============================================================================

-- 1. Make created_by / requested_by nullable for direct client entry without auth sessions
ALTER TABLE public.fuel_deliveries ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.customer_advances ALTER COLUMN requested_by DROP NOT NULL;
ALTER TABLE public.customer_financial_transactions ALTER COLUMN recorded_by DROP NOT NULL;

-- Allow direct driver/staff profiles creation
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. Update Delivery Charge posting trigger to support nullable recorded_by
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

-- 3. Update Advance Approval posting trigger to support nullable recorded_by
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

-- 4. Enable Development RLS Policies for Anon Role
DROP POLICY IF EXISTS "Allow anon all on profiles" ON public.profiles;
CREATE POLICY "Allow anon all on profiles" 
    ON public.profiles FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on routes" ON public.distribution_routes;
CREATE POLICY "Allow anon all on routes" 
    ON public.distribution_routes FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on customers" ON public.customers;
CREATE POLICY "Allow anon all on customers" 
    ON public.customers FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on stations" ON public.fuel_stations;
CREATE POLICY "Allow anon all on stations" 
    ON public.fuel_stations FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on products" ON public.fuel_products;
CREATE POLICY "Allow anon all on products" 
    ON public.fuel_products FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on staff_routes" ON public.staff_route_assignments;
CREATE POLICY "Allow anon all on staff_routes" 
    ON public.staff_route_assignments FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on staff_stations" ON public.staff_station_assignments;
CREATE POLICY "Allow anon all on staff_stations" 
    ON public.staff_station_assignments FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on deliveries" ON public.fuel_deliveries;
CREATE POLICY "Allow anon all on deliveries" 
    ON public.fuel_deliveries FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on advances" ON public.customer_advances;
CREATE POLICY "Allow anon all on advances" 
    ON public.customer_advances FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on transactions" ON public.customer_financial_transactions;
CREATE POLICY "Allow anon all on transactions" 
    ON public.customer_financial_transactions FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on audit_logs" ON public.audit_logs;
CREATE POLICY "Allow anon all on audit_logs" 
    ON public.audit_logs FOR ALL TO anon USING (true) WITH CHECK (true);
