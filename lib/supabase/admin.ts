import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./config";
import { createTimedFetch } from "@/lib/timedFetch";

export function createAdminClient(options?: { timeoutMs?: number }) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    ...(options?.timeoutMs
      ? { global: { fetch: createTimedFetch(options.timeoutMs) } }
      : {}),
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
