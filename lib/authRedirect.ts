export const postLoginPath = "/details";
const defaultProductionOrigin = "https://interv2.netlify.app";

export function isNetlifyBranchDeploy(origin: string) {
  try {
    const hostname = new URL(origin).hostname;
    return hostname.endsWith(".netlify.app") && hostname.includes("--");
  } catch {
    return false;
  }
}

export function productionOAuthOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;

  if (!configuredOrigin || isNetlifyBranchDeploy(configuredOrigin)) {
    return defaultProductionOrigin;
  }

  return configuredOrigin;
}

export function safeLocalOAuthOrigin(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const isLocalhost =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]";

    if ((url.protocol === "http:" || url.protocol === "https:") && isLocalhost) {
      return url.origin;
    }
  } catch {
    return null;
  }

  return null;
}

function oauthOrigin(origin: string) {
  return isNetlifyBranchDeploy(origin) ? productionOAuthOrigin() : origin;
}

export function createOAuthRedirectUrl(
  origin: string,
  nextPath = postLoginPath,
) {
  const redirectUrl = new URL("/auth/callback", oauthOrigin(origin));
  redirectUrl.searchParams.set("next", safeInternalPath(nextPath));
  const localReturnOrigin = safeLocalOAuthOrigin(origin);

  if (localReturnOrigin) {
    redirectUrl.searchParams.set("return_origin", localReturnOrigin);
  }

  return redirectUrl.toString();
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
