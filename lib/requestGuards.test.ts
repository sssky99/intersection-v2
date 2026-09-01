import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "@/lib/requestGuards";

describe("isSameOriginRequest", () => {
  it("uses the public host header when the internal request URL differs", () => {
    const request = new Request("http://localhost:3000/api/admin/session", {
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
      },
    });

    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("supports forwarded host and protocol from a trusted proxy", () => {
    const request = new Request("http://internal:3000/api/admin/session", {
      headers: {
        host: "internal:3000",
        origin: "https://interv2.netlify.app",
        "x-forwarded-host": "interv2.netlify.app",
        "x-forwarded-proto": "https",
      },
    });

    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("still rejects a genuinely different origin", () => {
    const request = new Request("http://localhost:3000/api/admin/session", {
      headers: {
        host: "127.0.0.1:3000",
        origin: "https://example.com",
      },
    });

    expect(isSameOriginRequest(request)).toBe(false);
  });
});
