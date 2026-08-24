import { createBrowserClient } from '@supabase/ssr';
import { supabaseAnonKey, supabaseUrl } from './config';
import { createTimedFetch } from '@/lib/timedFetch';

export function createClient(options?: { timeoutMs?: number }) {
  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
    options?.timeoutMs
      ? { global: { fetch: createTimedFetch(options.timeoutMs) } }
      : undefined,
  );
}
