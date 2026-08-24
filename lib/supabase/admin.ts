import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./config";
import { createTimedFetch } from "@/lib/timedFetch";

export function createAdminClient(options?: { timeoutMs?: number }) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    db: {
      // A degraded database must fail fast instead of multiplying load with
      // PostgREST's built-in retries.
      retry: false,
    },
    ...(options?.timeoutMs
      ? { global: { fetch: createTimedFetch(options.timeoutMs) } }
      : {}),
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
