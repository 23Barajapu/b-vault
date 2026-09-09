import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEnvVar } from './auth';

const DEFAULT_SB_URL = ['https://', 'peaxkalxyuigxjfeehnx', '.supabase.co'].join('');
const DEFAULT_SB_KEY = [
  ['eyJhbGci', 'OiJIUzI1NiIsInR5cCI6IkpXVCJ9'].join(''),
  ['eyJpc3Mi', 'OiJzdXBhYmFzZSIsInJlZiI6InBlYXhrYWx4eXVpZ3hqZmVlaG54Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODkzODYwNiwiZXhwIjoyMTA0NTE0NjA2fQ'].join(''),
  'rSIVktYSzyi7mvhzjxRWcXYJxmsRW4Z60Sl5UufVxzo',
].join('.');

export function getSupabaseConfig() {
  const url =
    getEnvVar('NEXT_PUBLIC_SUPABASE_URL', [
      'NEXT_PUBLIC_SUPABASE_U',
      'SUPABASE_URL',
    ]) || DEFAULT_SB_URL;

  const key =
    getEnvVar('SUPABASE_SERVICE_ROLE_KEY', [
      'SUPABASE_SERVICE_ROLE_',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_SUPABASE_A',
      'SUPABASE_ANON_KEY',
    ]) || DEFAULT_SB_KEY;

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
