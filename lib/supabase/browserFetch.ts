import { createTimedFetch } from "@/lib/timedFetch";

// The browser SDK is a singleton. Analytics may create it first with a short
// database timeout, but that must never shorten login or token-refresh requests.
export function createBrowserSupabaseFetch(dataTimeoutMs: number): typeof fetch {
  const authFetch = createTimedFetch(15000);
  const dataFetch = createTimedFetch(dataTimeoutMs);
  return (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return new URL(url).pathname.startsWith("/auth/v1/")
      ? authFetch(input, init)
      : dataFetch(input, init);
  };
}
