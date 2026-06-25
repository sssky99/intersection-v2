export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
export const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

type AnalyticsParamValue = string | number | boolean;
type AnalyticsParams = Record<
  string,
  AnalyticsParamValue | null | undefined
>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function cleanParams(params: AnalyticsParams) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== null && value !== undefined,
    ),
  ) as Record<string, AnalyticsParamValue>;
}

export function trackEvent(
  eventName: string,
  params: AnalyticsParams = {},
) {
  if (typeof window === "undefined") return;

  const payload = cleanParams(params);
  window.dataLayer = window.dataLayer ?? [];

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, payload);
    return;
  }

  window.dataLayer.push(["event", eventName, payload]);
}

export function trackLoginSuccessFromUrl(defaultLoginType?: string) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  if (url.searchParams.get("login") !== "success") return;

  const loginType =
    url.searchParams.get("login_type") ?? defaultLoginType ?? undefined;
  trackEvent("login_success", {
    login_type: loginType,
  });

  url.searchParams.delete("login");
  url.searchParams.delete("login_type");
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}
