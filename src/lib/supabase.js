import { createClient } from '@supabase/supabase-js';

// Connection details come from the build environment only. They used to fall
// back to a hardcoded project URL and anon key, which shipped the live anon
// key to every visitor in the JavaScript bundle. Without configuration the
// app now runs in offline mode instead.
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

const looksPlaceholder = (value) =>
  !value || value.includes('your-project') || value.includes('your-anon-key');

export const isSupabaseConfigured = Boolean(
  !looksPlaceholder(supabaseUrl) && !looksPlaceholder(supabaseAnonKey)
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
