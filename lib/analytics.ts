export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
export const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

type AnalyticsParamValue = string | number | boolean;
type AnalyticsParams = Record<
  string,
  AnalyticsParamValue | null | undefined
>;
type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

const anonymousSessionStorageKey = "intersection_anonymous_session_id";
const acquisitionStorageKey = "intersection_acquisition_context";
const landingExperimentCookie = "landing_ab_v1";
const landingExperimentId = "landing_ab_2026_08";

const supabaseEventNameAliases: Record<string, string> = {
  kakao_start_click: "kakao_login_click",
  meeting_ticket_detail_open: "ticket_detail_view",
  recommend_tab_view: "recommendation_view",
  profile_intro_complete: "profile_generated",
};
const clarityUpgradeEvents = new Set([
  "landing_video_complete",
  "phone_verification_complete",
  "questions_complete",
  "basic_info_complete",
  "profile_complete",
  "profile_intro_complete",
  "application_created",
  "invitation_yes",
  "payment_completed",
]);
const clarityFunnelStatuses: Record<string, string> = {
  landing_video_complete: "landing_video_completed",
  phone_input_view: "phone_input_viewed",
  phone_verification_complete: "phone_verified",
  question_start: "question_started",
  questions_complete: "questions_completed",
  basic_info_start: "basic_info_started",
  basic_info_complete: "basic_info_completed",
  profile_complete: "profile_completed",
  profile_intro_complete: "profile_generated",
  recommendation_view: "recommendation_viewed",
  application_created: "application_created",
  invitation_yes: "invitation_yes",
  payment_completed: "payment_completed",
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    clarity?: ClarityFn;
    fbq?: (...args: unknown[]) => void;
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
    captured_at: String(Date.now()),
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

export function checkoutAttributionContext() {
  const acquisition = acquisitionContext();
  const cleanValue = (value: unknown, maxLength = 160) =>
    typeof value === "string" ? value.trim().slice(0, maxLength) : "";
  let referrerHost = "";

  try {
    const initialReferrer = cleanValue(acquisition.initial_referrer, 500);
    referrerHost = initialReferrer
      ? new URL(initialReferrer).hostname.toLowerCase().slice(0, 160)
      : "";
  } catch {
    referrerHost = "";
  }

  const utmSource = cleanValue(acquisition.utm_source);
  const utmMedium = cleanValue(acquisition.utm_medium);
  const utmCampaign = cleanValue(acquisition.utm_campaign);
  const utmContent = cleanValue(acquisition.utm_content);
  const landingPathValue = cleanValue(acquisition.landing_path, 500);
  const fbclid = cleanValue(acquisition.fbclid, 500);
  const capturedAt = Number(acquisition.captured_at);
  const cookieValue = (name: string) =>
    document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1)
      .trim() ?? "";
  const metaFbp = cleanValue(cookieValue("_fbp"), 255);
  const cookieFbc = cleanValue(cookieValue("_fbc"), 500);
  const derivedFbc =
    fbclid && Number.isFinite(capturedAt)
      ? `fb.1.${Math.floor(capturedAt / 1000)}.${fbclid}`
      : "";
  let landingPath = "";
  try {
    landingPath = new URL(landingPathValue, window.location.origin).pathname.slice(
      0,
      240,
    );
  } catch {
    landingPath = window.location.pathname.slice(0, 240);
  }

  return {
    source_type: utmSource || utmMedium ? "utm" : referrerHost ? "referral" : "direct",
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    utm_content: utmContent,
    referrer_host: referrerHost,
    landing_path: landingPath,
    meta_fbp: metaFbp,
    meta_fbc: cookieFbc || derivedFbc,
    meta_user_agent: navigator.userAgent.slice(0, 500),
  };
}

function landingExperimentContext() {
  const cookieValue = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${landingExperimentCookie}=`))
    ?.split("=")[1];

  if (cookieValue !== "a" && cookieValue !== "b") return {};
  return {
    experiment_id: landingExperimentId,
    landing_variant: cookieValue,
  };
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

const metaStandardEvents: Record<string, string> = {
  landing_cta_click: "ViewContent",
  profile_complete: "CompleteRegistration",
  application_created: "Lead",
  payment_page_open: "InitiateCheckout",
  membership_purchase_click: "InitiateCheckout",
};

function metaStandardParams(
  eventName: string,
  payload: Record<string, AnalyticsParamValue>,
) {
  const amount =
    typeof payload.value === "number"
      ? payload.value
      : typeof payload.deposit_amount === "number"
        ? payload.deposit_amount
        : typeof payload.amount === "number"
          ? payload.amount
          : undefined;

  return cleanParams({
    page_group: pageGroup(window.location.pathname),
    content_name:
      eventName === "profile_complete"
        ? "profile"
        : typeof payload.payment_option === "string"
          ? payload.payment_option
          : undefined,
    value: amount,
    currency: amount === undefined ? undefined : "KRW",
  });
}

function trackMetaEvent(
  eventName: string,
  payload: Record<string, AnalyticsParamValue>,
) {
  if (
    !META_PIXEL_ID ||
    !shouldTrackBrowserAnalytics() ||
    typeof window.fbq !== "function"
  ) {
    return;
  }

  try {
    const context = {
      ...payload,
      page_group: pageGroup(window.location.pathname),
    };
    window.fbq("trackCustom", eventName, context);

    const standardEvent = metaStandardEvents[eventName];
    if (standardEvent) {
      window.fbq("track", standardEvent, metaStandardParams(eventName, payload));
    }
  } catch {
    // Meta Pixel should never interrupt the user flow.
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
      ...landingExperimentContext(),
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
  trackMetaEvent(eventName, payload);
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
