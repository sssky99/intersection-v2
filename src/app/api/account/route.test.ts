import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();
const createAdminClientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

function adminClient(options?: { deleteFails?: boolean }) {
  const list = vi.fn(async () => ({
    data: [{ name: "profile.jpg" }],
    error: null,
  }));
  const remove = vi.fn(async () => ({ error: null }));
  const deleteUser = vi.fn(async () =>
    options?.deleteFails
      ? { data: null, error: { message: "delete failed" } }
      : { data: {}, error: null },
  );

  return {
    client: {
      storage: { from: vi.fn(() => ({ list, remove })) },
      auth: { admin: { deleteUser } },
    },
    list,
    remove,
    deleteUser,
  };
}

describe("/api/account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires an authenticated user", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      },
    });
    const { DELETE } = await import("./route");

    expect((await DELETE()).status).toBe(401);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("removes owned profile photos before deleting the auth user", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        })),
      },
    });
    const admin = adminClient();
    createAdminClientMock.mockReturnValue(admin.client);
    const { DELETE } = await import("./route");

    const response = await DELETE();
    expect(response.status).toBe(200);
    expect(admin.list).toHaveBeenCalledWith("user-1", { limit: 1000 });
    expect(admin.remove).toHaveBeenCalledWith(["user-1/profile.jpg"]);
    expect(admin.deleteUser).toHaveBeenCalledWith("user-1");
    expect(admin.remove.mock.invocationCallOrder[0]).toBeLessThan(
      admin.deleteUser.mock.invocationCallOrder[0],
    );
  });

  it("returns an error when account deletion fails", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        })),
      },
    });
    const admin = adminClient({ deleteFails: true });
    createAdminClientMock.mockReturnValue(admin.client);
    const { DELETE } = await import("./route");

    expect((await DELETE()).status).toBe(500);
  });
});
