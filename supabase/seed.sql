-- -- ============================================================================
-- -- OIL DISTRIBUTION MANAGEMENT SYSTEM - SEED DATA (OPTIONAL / DEMO)
-- -- ============================================================================

-- -- Insert standard fuel product grades
-- INSERT INTO public.fuel_products (product_code, name, current_unit_price, unit_of_measure, is_active)
-- VALUES 
--     ('DSL-50', 'Diesel 50ppm', 3.85, 'Liters', true),
--     ('RON-95', 'Super Petrol (RON 95)', 4.20, 'Liters', true),
--     ('RON-98', 'Premium Petrol (RON 98)', 4.65, 'Liters', true)
-- ON CONFLICT (product_code) DO NOTHING;

-- -- Insert demonstration distribution route
-- INSERT INTO public.distribution_routes (route_code, name, description, is_active)
-- VALUES 
--     ('RT-NORTH-01', 'Northern Coastal Highway Route', 'Covers northern stations along the coastal highway corridor', true),
--     ('RT-CENTRAL-02', 'Central Industrial Zone Route', 'Commercial and industrial transport distribution corridor', true)
-- ON CONFLICT (route_code) DO NOTHING;

-- -- Insert demonstration customer
-- INSERT INTO public.customers (customer_code, name, company_name, email, phone, billing_address, credit_limit, is_active)
-- VALUES 
--     ('CUST-1001', 'Ahmed Al-Mansoor', 'Al-Mansoor Fuel Services LLC', 'ahmed@almansoor-oil.com', '+971-50-1234567', 'Industrial Area 4, Sharjah', 150000.00, true),
--     ('CUST-1002', 'Rashid Trading Corp', 'Rashid Logistics & Energy', 'rashid@rashidenergy.com', '+971-55-9876543', 'Jebel Ali Free Zone, Dubai', 200000.00, true)
-- ON CONFLICT (customer_code) DO NOTHING;
