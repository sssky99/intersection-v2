import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAnonKey, supabaseUrl } from './config';
import { createTimedFetch } from '@/lib/timedFetch';

export async function createClient(options?: { timeoutMs?: number }) {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    ...(options?.timeoutMs
      ? { global: { fetch: createTimedFetch(options.timeoutMs) } }
      : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignore when called from a Server Component render.
        }
      },
    },
  });
}
