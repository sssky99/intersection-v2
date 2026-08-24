import { createBrowserClient } from '@supabase/ssr';
import { supabaseAnonKey, supabaseUrl } from './config';
import { createTimedFetch } from '@/lib/timedFetch';

export function createClient(options?: { timeoutMs?: number }) {
  const timeoutMs = options?.timeoutMs ?? 5000;

  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      db: {
        // Do not retry transient Data API failures from the browser. When the
        // database is saturated, retries make the outage self-reinforcing.
        retry: false,
      },
      global: { fetch: createTimedFetch(timeoutMs) },
    },
  );
}
