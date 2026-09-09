import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEnvVar } from './auth';

export function getSupabaseConfig() {
  const url = getEnvVar('NEXT_PUBLIC_SUPABASE_URL', [
    'NEXT_PUBLIC_SUPABASE_U',
    'SUPABASE_URL',
  ]);
  const key = getEnvVar('SUPABASE_SERVICE_ROLE_KEY', [
    'SUPABASE_SERVICE_ROLE_',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_A',
    'SUPABASE_ANON_KEY',
  ]);
  return { url, key };
}

const { url: supabaseUrl, key: supabaseKey } = getSupabaseConfig();

// Create Supabase client (Edge & Node.js compatible)
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseConfig();
  return Boolean(url && key && url !== 'https://placeholder.supabase.co');
}

export default supabase;
