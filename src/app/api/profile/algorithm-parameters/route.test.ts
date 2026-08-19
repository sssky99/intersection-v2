import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const createClientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

function parameterQuery(result: unknown) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(async () => result),
  };
  return query;
}

function request(parameters: unknown) {
  return new Request("http://localhost/api/profile/algorithm-parameters", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parameters }),
  }) as NextRequest;
}

describe("/api/profile/algorithm-parameters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires an authenticated user", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null } })),
      },
    });

    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("loads the current user's parameters in priority order", async () => {
    const query = parameterQuery({
      data: [
        {
          question_order: 203,
          mode: "similar",
          position: 1,
          updated_at: "2026-08-19T00:00:00Z",
        },
      ],
      error: null,
    });
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
      },
      from: vi.fn(() => query),
    });

    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      parameters: [
        {
          questionOrder: 203,
          mode: "similar",
          position: 1,
          updatedAt: "2026-08-19T00:00:00Z",
        },
      ],
    });
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("rejects more than three parameters", async () => {
    const rpc = vi.fn();
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
      },
      rpc,
    });

    const { PUT } = await import("./route");
    const response = await PUT(
      request(
        [101, 102, 103, 104].map((questionOrder) => ({
          questionOrder,
          mode: "similar",
        })),
      ),
    );
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("replaces and returns the saved parameter set", async () => {
    const query = parameterQuery({
      data: [
        {
          question_order: 203,
          mode: "different",
          position: 1,
          updated_at: "2026-08-19T00:00:00Z",
        },
      ],
      error: null,
    });
    const rpc = vi.fn(async () => ({ error: null }));
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
      },
      rpc,
      from: vi.fn(() => query),
    });

    const { PUT } = await import("./route");
    const response = await PUT(
      request([{ questionOrder: 203, mode: "different" }]),
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("replace_my_algorithm_parameters", {
      new_parameters: [{ question_order: 203, mode: "different" }],
    });
  });
});
