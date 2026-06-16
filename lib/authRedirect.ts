export const postLoginPath = "/details";
const localOAuthOrigin = "http://localhost:3000";

export function createOAuthRedirectUrl(origin: string) {
  const callbackOrigin =
    process.env.NODE_ENV === "development" ? localOAuthOrigin : origin;

  return new URL("/auth/callback", callbackOrigin).toString();
}

export function safeInternalPath(
  value: string | null,
  fallback = postLoginPath,
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}
