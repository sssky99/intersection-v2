import { createAdminClient as createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AsyncLocalStorage } from "node:async_hooks";
import "server-only";

export const webhookScope = new AsyncLocalStorage<{
  token: string;
  signal: AbortSignal;
}>();

export function createAdminClient() {
  return createSupabaseAdminClient({
    timeoutMs: 10_000,
    signal: webhookScope.getStore()?.signal,
  });
}
