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

function oauthOrigin(origin: string) {
  return isNetlifyBranchDeploy(origin) ? productionOAuthOrigin() : origin;
}

export function createOAuthRedirectUrl(
  origin: string,
  nextPath = postLoginPath,
) {
  const redirectUrl = new URL("/auth/callback", oauthOrigin(origin));
  redirectUrl.searchParams.set("next", safeInternalPath(nextPath));

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
