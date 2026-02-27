import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Server-side Supabase client.
 * Prefers service_role (bypasses RLS). Falls back to anon if service_role is missing.
 * Add SUPABASE_SERVICE_ROLE_KEY in .env.local for full access (Settings → API in Supabase).
 */
export function createSupabaseAdmin() {
  const key = supabaseServiceKey || supabaseAnonKey;
  if (!supabaseUrl || !key) {
    const hint =
      typeof window === 'undefined'
        ? `[Server] URL: ${supabaseUrl ? 'ok' : 'MISSING'}, service_role: ${supabaseServiceKey ? 'ok' : 'MISSING'}, anon: ${supabaseAnonKey ? 'ok' : 'MISSING'}. On Vercel: add env vars in Project Settings → Environment Variables, then Redeploy.`
        : 'Missing Supabase keys. Check .env.local (local) or Vercel env vars (deployed).';
    throw new Error(`Missing Supabase keys. ${hint}`);
  }
  return createClient(supabaseUrl, key);
}

/**
 * Client-side Supabase client with anon key.
 * Use in browser for public reads if needed.
 */
export function createSupabaseClient() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase env vars');
  }
  return createClient(supabaseUrl, anonKey);
}

export const BUCKET_NAME = 'Documents';
