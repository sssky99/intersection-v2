import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/user-events", () => {
  it("finishes legacy analytics requests without doing any work", async () => {
    const response = await POST();

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });
});
