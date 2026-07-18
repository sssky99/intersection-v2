export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
export const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

type AnalyticsParamValue = string | number | boolean;
type AnalyticsParams = Record<
  string,
  AnalyticsParamValue | null | undefined
>;
type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

const anonymousSessionStorageKey = "intersection_anonymous_session_id";
const acquisitionStorageKey = "intersection_acquisition_context";

const supabaseEventNameAliases: Record<string, string> = {
  kakao_start_click: "kakao_login_click",
  recommend_tab_view: "recommendation_view",
  profile_intro_complete: "profile_generated",
};
const clarityUpgradeEvents = new Set([
  "questions_complete",
  "basic_info_complete",
  "profile_intro_complete",
  "application_created",
]);
const clarityFunnelStatuses: Record<string, string> = {
  question_start: "question_started",
  questions_complete: "questions_completed",
  basic_info_start: "basic_info_started",
  basic_info_complete: "profile_completed",
  profile_intro_complete: "profile_generated",
  recommendation_view: "recommendation_viewed",
  application_created: "application_created",
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    clarity?: ClarityFn;
  }
}

function cleanParams(params: AnalyticsParams) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== null && value !== undefined,
    ),
  ) as Record<string, AnalyticsParamValue>;
}

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `anon_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function anonymousSessionId() {
  try {
    const existing = window.localStorage.getItem(anonymousSessionStorageKey);
    if (existing) return existing;

    const nextId = randomId();
    window.localStorage.setItem(anonymousSessionStorageKey, nextId);
    return nextId;
  } catch {
    return randomId();
  }
}

function supabaseEventName(eventName: string) {
  return supabaseEventNameAliases[eventName] ?? eventName;
}

function applicationIdFromPayload(payload: Record<string, AnalyticsParamValue>) {
  const value = payload.application_id ?? payload.applicationId;
  return typeof value === "string" ? value : undefined;
}

function acquisitionContext() {
  const url = new URL(window.location.href);
  const current = {
    utm_source: url.searchParams.get("utm_source") ?? "",
    utm_medium: url.searchParams.get("utm_medium") ?? "",
    utm_campaign: url.searchParams.get("utm_campaign") ?? "",
    utm_content: url.searchParams.get("utm_content") ?? "",
    fbclid: url.searchParams.get("fbclid") ?? "",
    initial_referrer: document.referrer || "",
    landing_path: `${url.pathname}${url.search}`,
  };
  const hasCampaignMarker = Boolean(
    current.utm_source ||
      current.utm_medium ||
      current.utm_campaign ||
      current.utm_content ||
      current.fbclid,
  );

  try {
    if (hasCampaignMarker) {
      window.localStorage.setItem(acquisitionStorageKey, JSON.stringify(current));
      return current;
    }
    const stored = window.localStorage.getItem(acquisitionStorageKey);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      );
    }
    window.localStorage.setItem(acquisitionStorageKey, JSON.stringify(current));
  } catch {
    // Attribution must never interrupt the user flow.
  }
  return current;
}

function isLocalHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    hostname.endsWith(".localhost")
  );
}

function shouldTrackBrowserAnalytics() {
  return (
    process.env.NODE_ENV === "production" &&
    !isLocalHostname(window.location.hostname) &&
    window.location.pathname !== "/admin" &&
    !window.location.pathname.startsWith("/admin/")
  );
}

function shouldTrackSupabaseEvent() {
  return shouldTrackBrowserAnalytics();
}

function ensureClarityQueue() {
  if (typeof window.clarity === "function") return window.clarity;

  window.clarity = ((...args: unknown[]) => {
    const clarity = window.clarity;
    if (!clarity) return;
    clarity.q = clarity.q ?? [];
    clarity.q.push(args);
  }) as ClarityFn;

  return window.clarity;
}

function callClarity(...args: unknown[]) {
  if (!CLARITY_PROJECT_ID || !shouldTrackBrowserAnalytics()) return;

  try {
    ensureClarityQueue()(...args);
  } catch {
    // Clarity should never interrupt the user flow.
  }
}

function currentPageId() {
  return `${window.location.pathname}${window.location.search}`;
}

function pageGroup(pathname: string) {
  if (pathname === "/") return "landing";
  if (pathname.startsWith("/onboarding/questions")) return "onboarding_questions";
  if (pathname.startsWith("/onboarding/profile")) return "onboarding_profile";
  if (pathname.startsWith("/meetings")) return "meetings";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/browse")) return "browse";
  return "other";
}

function trackClarityEvent(
  eventName: string,
  payload: Record<string, AnalyticsParamValue>,
) {
  callClarity("event", eventName);
  callClarity("set", "last_event", eventName);
  callClarity("set", "last_event_path", currentPageId());
  callClarity("set", "page_group", pageGroup(window.location.pathname));

  const status = clarityFunnelStatuses[eventName];
  if (status) callClarity("set", "funnel_status", status);

  const mode = payload.mode;
  if (typeof mode === "string") callClarity("set", "event_mode", mode);

  if (clarityUpgradeEvents.has(eventName)) {
    callClarity("upgrade", eventName);
  }
}

function trackSupabaseEvent(
  eventName: string,
  payload: Record<string, AnalyticsParamValue>,
) {
  if (!shouldTrackSupabaseEvent()) return;

  const normalizedEventName = supabaseEventName(eventName);
  const body = JSON.stringify({
    anonymousSessionId: anonymousSessionId(),
    applicationId: applicationIdFromPayload(payload),
    eventName: normalizedEventName,
    path: window.location.pathname,
    referrer: document.referrer || null,
    metadata: {
      ...payload,
      ...acquisitionContext(),
      ...(normalizedEventName === eventName
        ? {}
        : { original_event_name: eventName }),
    },
  });

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(
      "/api/user-events",
      new Blob([body], { type: "application/json" }),
    );
    if (sent) return;
  }

  void fetch("/api/user-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Analytics should never interrupt the user flow.
  });
}

export function trackEvent(
  eventName: string,
  params: AnalyticsParams = {},
) {
  if (typeof window === "undefined") return;

  const payload = cleanParams(params);
  window.dataLayer = window.dataLayer ?? [];
  trackClarityEvent(eventName, payload);
  trackSupabaseEvent(eventName, payload);

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, payload);
    return;
  }

  window.dataLayer.push(["event", eventName, payload]);
}

export function identifyAnalyticsUser(userId: string) {
  if (typeof window === "undefined" || !userId) return;

  callClarity("identify", userId, anonymousSessionId(), currentPageId());
}

export function trackAnalyticsPageView() {
  if (typeof window === "undefined") return;

  callClarity("set", "current_path", currentPageId());
  callClarity("set", "page_group", pageGroup(window.location.pathname));
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
