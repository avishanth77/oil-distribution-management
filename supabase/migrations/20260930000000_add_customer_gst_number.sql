-- Migration: 20260930000000_add_customer_gst_number.sql
-- Description: Add GSTIN / GST Number column to customers table

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS gst_number TEXT;
COMMENT ON COLUMN public.customers.gst_number IS 'GST Identification Number (GSTIN) for commercial tax compliance';
