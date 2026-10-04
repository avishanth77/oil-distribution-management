import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://pzdvxixrknjobeekdoin.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6ZHZ4aXhya25qb2JlZWtkb2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NDcyMjEsImV4cCI6MjEwNjIyMzIyMX0.opLcoS5RPVFZkti2Om4QxuJadCvZ1XjuTE9p8dsgIGE';

const rawUrl = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_SUPABASE_URL : undefined;
const rawKey = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;

const supabaseUrl = (rawUrl && !rawUrl.includes('your-project')) ? rawUrl : FALLBACK_URL;
const supabaseAnonKey = (rawKey && !rawKey.includes('your-anon-key')) ? rawKey : FALLBACK_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon-key')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
