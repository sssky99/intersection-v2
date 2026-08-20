import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildMetaPurchaseEvent,
  normalizeMetaPhone,
} from "./metaConversions";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  }
});

describe("Meta purchase payload", () => {
  it("normalizes Korean phone numbers for hashing", () => {
    expect(normalizeMetaPhone("010-1234-5678")).toBe("821012345678");
    expect(normalizeMetaPhone("+82 10 1234 5678")).toBe("821012345678");
  });

  it("builds a deduplicated Purchase event without raw identifiers", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";

    const event = buildMetaPurchaseEvent({
      provider: "groble",
      providerEventId: "payment-123",
      userId: "15f9874b-3e7f-46d0-a253-993d0364a43e",
      phone: "010-1234-5678",
      productCode: "meeting_date_ticket",
      amount: 10_000,
      currency: "KRW",
      occurredAt: "2026-08-20T12:34:56.000Z",
      acquisitionContext: {
        landing_path: "/instagram",
        meta_fbp: "fb.1.1724000000.browser-id",
        meta_fbc: "fb.1.1724000000.click-id",
        meta_user_agent: "test-agent",
      },
    });

    expect(event).toMatchObject({
      event_name: "Purchase",
      event_time: 1787229296,
      event_id: "purchase:groble:payment-123",
      action_source: "website",
      event_source_url: "https://example.com/instagram",
      user_data: {
        fbp: "fb.1.1724000000.browser-id",
        fbc: "fb.1.1724000000.click-id",
        client_user_agent: "test-agent",
      },
      custom_data: {
        value: 10_000,
        currency: "KRW",
        content_ids: ["meeting_date_ticket"],
        order_id: "payment-123",
      },
    });
    expect(event.user_data.external_id[0]).toHaveLength(64);
    expect(event.user_data.ph?.[0]).toHaveLength(64);
    expect(JSON.stringify(event)).not.toContain("010-1234-5678");
    expect(JSON.stringify(event)).not.toContain(
      "15f9874b-3e7f-46d0-a253-993d0364a43e",
    );
  });
});
