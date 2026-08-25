import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();
const createAdminClientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

function request(storagePath: string) {
  return new Request("http://localhost/api/profile/photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storagePath }),
  });
}

function adminClient(options?: {
  updateFails?: boolean;
  verificationMisses?: number;
}) {
  const remove = vi.fn(async () => ({ error: null }));
  let verificationAttempts = 0;
  const storageBucket = {
    list: vi.fn(async () => {
      verificationAttempts += 1;
      return {
        data:
          verificationAttempts <= (options?.verificationMisses ?? 0)
            ? []
            : [
                {
                  name: "123-photo.jpg",
                  metadata: { mimetype: "image/jpeg", size: 1024 },
                },
              ],
        error: null,
      };
    }),
    getPublicUrl: vi.fn(() => ({
      data: { publicUrl: "https://example.test/123-photo.jpg" },
    })),
    remove,
  };
  const profileQuery = {
    update: vi.fn(() => profileQuery),
    eq: vi.fn(() => profileQuery),
    select: vi.fn(() => profileQuery),
    maybeSingle: vi.fn(async () =>
      options?.updateFails
        ? { data: null, error: { message: "save failed" } }
        : {
            data: { photo_url: "https://example.test/123-photo.jpg" },
            error: null,
          },
    ),
  };
  return {
    client: {
      storage: { from: vi.fn(() => storageBucket) },
      from: vi.fn(() => profileQuery),
    },
    remove,
    list: storageBucket.list,
  };
}

describe("/api/profile/photo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires an authenticated user", async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    });
    const { POST } = await import("./route");
    expect((await POST(request("user-1/123-photo.jpg"))).status).toBe(401);
  });

  it("rejects a path owned by another user", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
      },
    });
    const { POST } = await import("./route");
    expect((await POST(request("user-2/123-photo.jpg"))).status).toBe(400);
  });

  it("links an uploaded photo to the authenticated profile", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
      },
    });
    const admin = adminClient();
    createAdminClientMock.mockReturnValue(admin.client);
    const { POST } = await import("./route");
    const response = await POST(request("user-1/123-photo.jpg"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      photoUrl: "https://example.test/123-photo.jpg",
    });
    expect(admin.remove).not.toHaveBeenCalled();
  });

  it("retries when a new storage object is not immediately visible", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
      },
    });
    const admin = adminClient({ verificationMisses: 1 });
    createAdminClientMock.mockReturnValue(admin.client);
    const { POST } = await import("./route");
    const response = await POST(request("user-1/123-photo.jpg"));
    expect(response.status).toBe(200);
    expect(admin.list).toHaveBeenCalledTimes(2);
  });

  it("removes the uploaded file when the profile update fails", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
      },
    });
    const admin = adminClient({ updateFails: true });
    createAdminClientMock.mockReturnValue(admin.client);
    const { POST } = await import("./route");
    const response = await POST(request("user-1/123-photo.jpg"));
    expect(response.status).toBe(500);
    expect(admin.remove).toHaveBeenCalledWith(["user-1/123-photo.jpg"]);
  });
});
