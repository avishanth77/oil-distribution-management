-- ============================================================================
-- SECURITY HARDENING
-- Revokes the anonymous "dev access" policies, blocks role self-escalation,
-- and enforces account activation server-side.
--
-- Apply this to the Supabase project AFTER any project where
-- 20260929000000_enable_dev_anon_access.sql was executed.
-- It is safe to apply to a project that never ran the dev-access migration.
-- ============================================================================

-- ============================================================================
-- 1. REVOKE ANONYMOUS ACCESS (fixes "Allow anon all on ..." policies)
-- ============================================================================

DROP POLICY IF EXISTS "Allow anon all on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow anon all on routes" ON public.distribution_routes;
DROP POLICY IF EXISTS "Allow anon all on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow anon all on stations" ON public.fuel_stations;
DROP POLICY IF EXISTS "Allow anon all on products" ON public.fuel_products;
DROP POLICY IF EXISTS "Allow anon all on staff_routes" ON public.staff_route_assignments;
DROP POLICY IF EXISTS "Allow anon all on staff_stations" ON public.staff_station_assignments;
DROP POLICY IF EXISTS "Allow anon all on deliveries" ON public.fuel_deliveries;
DROP POLICY IF EXISTS "Allow anon all on advances" ON public.customer_advances;
DROP POLICY IF EXISTS "Allow anon all on transactions" ON public.customer_financial_transactions;
DROP POLICY IF EXISTS "Allow anon all on audit_logs" ON public.audit_logs;

-- Belt-and-braces: strip table privileges from anon so the role cannot read
-- or write even if a permissive policy is reintroduced later.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================================================
-- 2. BLOCK PRIVILEGE ESCALATION VIA role COLUMN
-- ============================================================================

-- 2.1 Self-promotion guard: only an existing active manager may change role,
--     change is_active, or change the email on a profile.
CREATE OR REPLACE FUNCTION public.fn_guard_profile_privileges()
RETURNS TRIGGER AS $$
DECLARE
    actor_is_manager BOOLEAN;
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.email IS DISTINCT FROM OLD.email THEN

        SELECT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'manager' AND is_active = true
        ) INTO actor_is_manager;

        IF NOT actor_is_manager THEN
            RAISE EXCEPTION
                'Only an active Operations Manager may modify role, is_active, or email on a profile.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_guard_profile_privileges ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileges
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.fn_guard_profile_privileges();

-- 2.2 Signup must never mint a manager. raw_user_meta_data is attacker
--     controlled (anyone can call supabase.auth.signUp with arbitrary
--     user_metadata), so the role is hardcoded to 'staff'.
CREATE OR REPLACE FUNCTION public.fn_handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'staff'::public.user_role
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.3 profiles.id must reference auth.users again. The dev-access migration
--     dropped this FK so the browser could insert synthetic profiles.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2.4 Restore NOT NULL on actor columns that the dev migration relaxed.
ALTER TABLE public.fuel_deliveries ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE public.customer_advances ALTER COLUMN requested_by SET NOT NULL;
ALTER TABLE public.customer_financial_transactions ALTER COLUMN recorded_by SET NOT NULL;

-- ============================================================================
-- 3. SERVER-SIDE ACCOUNT ACTIVATION (fixes client-only is_active checks)
-- ============================================================================
-- Deactivating a staff member in the UI previously had no database effect, so
-- an already-issued Supabase JWT kept working until it expired. Every
-- permissive policy now also requires the caller to be an active profile.

CREATE OR REPLACE FUNCTION public.fn_is_active_user()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_active = true
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Staff-facing SELECT policies are re-created with the activation check.
-- Manager policies already require role='manager' AND is_active=true via
-- fn_is_manager(), so they need no change.

DROP POLICY IF EXISTS "Staff can view assigned routes" ON public.distribution_routes;
CREATE POLICY "Staff can view assigned routes"
    ON public.distribution_routes FOR SELECT
    USING (
        public.fn_is_active_user()
        AND id IN (SELECT public.fn_staff_assigned_routes())
    );

DROP POLICY IF EXISTS "Staff can view customers with assigned stations" ON public.customers;
CREATE POLICY "Staff can view customers with assigned stations"
    ON public.customers FOR SELECT
    USING (
        public.fn_is_active_user()
        AND id IN (
            SELECT customer_id FROM public.fuel_stations
            WHERE id IN (SELECT public.fn_staff_assigned_stations())
        )
    );

DROP POLICY IF EXISTS "Staff can view assigned stations" ON public.fuel_stations;
CREATE POLICY "Staff can view assigned stations"
    ON public.fuel_stations FOR SELECT
    USING (
        public.fn_is_active_user()
        AND id IN (SELECT public.fn_staff_assigned_stations())
    );

DROP POLICY IF EXISTS "Staff can view their own route assignments" ON public.staff_route_assignments;
CREATE POLICY "Staff can view their own route assignments"
    ON public.staff_route_assignments FOR SELECT
    USING (public.fn_is_active_user() AND staff_id = auth.uid());

DROP POLICY IF EXISTS "Staff can view their own station assignments" ON public.staff_station_assignments;
CREATE POLICY "Staff can view their own station assignments"
    ON public.staff_station_assignments FOR SELECT
    USING (public.fn_is_active_user() AND staff_id = auth.uid());

DROP POLICY IF EXISTS "Staff can view active products" ON public.fuel_products;
CREATE POLICY "Staff can view active products"
    ON public.fuel_products FOR SELECT
    USING (public.fn_is_active_user() AND is_active = true);

DROP POLICY IF EXISTS "Staff can view deliveries for assigned stations" ON public.fuel_deliveries;
CREATE POLICY "Staff can view deliveries for assigned stations"
    ON public.fuel_deliveries FOR SELECT
    USING (
        public.fn_is_active_user()
        AND station_id IN (SELECT public.fn_staff_assigned_stations())
    );

DROP POLICY IF EXISTS "Staff can insert deliveries for assigned stations" ON public.fuel_deliveries;
CREATE POLICY "Staff can insert deliveries for assigned stations"
    ON public.fuel_deliveries FOR INSERT
    WITH CHECK (
        public.fn_is_active_user()
        AND station_id IN (SELECT public.fn_staff_assigned_stations())
        AND created_by = auth.uid()
    );

DROP POLICY IF EXISTS "Staff can view advances for assigned customers" ON public.customer_advances;
CREATE POLICY "Staff can view advances for assigned customers"
    ON public.customer_advances FOR SELECT
    USING (
        public.fn_is_active_user()
        AND customer_id IN (
            SELECT customer_id FROM public.fuel_stations
            WHERE id IN (SELECT public.fn_staff_assigned_stations())
        )
    );

DROP POLICY IF EXISTS "Staff can request advances for assigned customers" ON public.customer_advances;
CREATE POLICY "Staff can request advances for assigned customers"
    ON public.customer_advances FOR INSERT
    WITH CHECK (
        public.fn_is_active_user()
        AND status = 'pending'
        AND requested_by = auth.uid()
        AND customer_id IN (
            SELECT customer_id FROM public.fuel_stations
            WHERE id IN (SELECT public.fn_staff_assigned_stations())
        )
    );

DROP POLICY IF EXISTS "Staff can view financial transactions for assigned stations" ON public.customer_financial_transactions;
CREATE POLICY "Staff can view financial transactions for assigned stations"
    ON public.customer_financial_transactions FOR SELECT
    USING (
        public.fn_is_active_user()
        AND (station_id IS NULL OR station_id IN (SELECT public.fn_staff_assigned_stations()))
    );

-- Staff must not rewrite their own profile row beyond display fields; the
-- privilege guard above already blocks role/is_active/email, and this policy
-- keeps the column set explicit.
DROP POLICY IF EXISTS "Users can update own non-role fields" ON public.profiles;
CREATE POLICY "Users can update own non-role fields"
    ON public.profiles FOR UPDATE
    USING (public.fn_is_active_user() AND id = auth.uid())
    WITH CHECK (public.fn_is_active_user() AND id = auth.uid());

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

-- ============================================================================
-- 4. REPOINT TRIGGERS THAT RELIED ON NULLABLE created_by
-- ============================================================================
-- NOT NULL is restored above, so these stay as originally written.

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
