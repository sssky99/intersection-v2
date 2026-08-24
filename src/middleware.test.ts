import { beforeEach, describe, expect, it, vi } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest, NextResponse } from "next/server";

const { refreshSupabaseSessionMock } = vi.hoisted(() => ({
  refreshSupabaseSessionMock: vi.fn(),
}));

vi.mock("@/lib/authRedirect", () => ({
  isNetlifyBranchDeploy: vi.fn(() => false),
  postLoginPath: "/meetings",
  productionOAuthOrigin: vi.fn(() => "https://interv2.netlify.app"),
  safeInternalPath: vi.fn((value, fallback) => value ?? fallback),
}));
vi.mock("@/lib/nativeAppRequest", () => ({
  isNativeAndroidRequest: vi.fn(() => false),
  isNativeRestrictedPath: vi.fn(() => false),
  isProductionPreviewPath: vi.fn(() => false),
}));
vi.mock("@/lib/supabase/middleware", () => ({
  refreshSupabaseSession: refreshSupabaseSessionMock,
}));

import { config, middleware } from "./middleware";

function matches(
  url: string,
  options?: {
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  },
) {
  return unstable_doesMiddlewareMatch({
    config,
    nextConfig: {},
    url: `https://interv2.netlify.app${url}`,
    headers: options?.headers,
    cookies: options?.cookies,
  });
}

describe("middleware matcher", () => {
  beforeEach(() => {
    refreshSupabaseSessionMock.mockReset();
    refreshSupabaseSessionMock.mockResolvedValue({
      response: NextResponse.next(),
      identity: null,
    });
  });

  it.each([
    "/images/intersection-mark.png",
    "/videos/landing-intro-v1.mp4",
    "/fonts/pretendard/Pretendard-Regular.subset.woff2",
    "/_next/static/chunks/app.js",
    "/robots.txt",
    "/sitemap.xml",
  ])("skips static asset %s", (url) => {
    expect(matches(url)).toBe(false);
  });

  it("skips regular API requests", () => {
    expect(matches("/api/meetings/available-tickets")).toBe(false);
  });

  it("keeps admin and dev APIs in middleware", () => {
    expect(matches("/api/admin/session")).toBe(true);
    expect(matches("/api/dev/test-login")).toBe(true);
  });

  it("keeps read-only admin user-view API requests in middleware", () => {
    expect(
      matches("/api/meetings/my-tickets", {
        cookies: { inter_admin_user_view: "preview-session" },
      }),
    ).toBe(true);
  });

  it("keeps application pages in middleware", () => {
    expect(matches("/meetings?tab=browse")).toBe(true);
  });

  it("serves the root landing without refreshing a Supabase session", async () => {
    const response = await middleware(
      new NextRequest("https://interv2.netlify.app/"),
    );

    expect(response.cookies.get("landing_ab_v1")?.value).toBe("b");
    expect(refreshSupabaseSessionMock).not.toHaveBeenCalled();
  });

  it("serves the Instagram landing without refreshing a Supabase session", async () => {
    await middleware(
      new NextRequest("https://interv2.netlify.app/instagram"),
    );

    expect(refreshSupabaseSessionMock).not.toHaveBeenCalled();
  });

  it("blocks writes while an admin user-view session is active", async () => {
    const response = await middleware(
      new NextRequest("https://interv2.netlify.app/api/profile/name", {
        method: "POST",
        headers: { cookie: "inter_admin_user_view=preview-session" },
      }),
    );

    expect(response.status).toBe(403);
    expect(refreshSupabaseSessionMock).not.toHaveBeenCalled();
  });
});
