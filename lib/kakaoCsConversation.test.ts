import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, it, expect } from "vitest";

describe("CS conversation isolation", () => {
  it("isolates history, leases, deduplication, and service-only access", async () => {
    const db = new PGlite();
    try {
      await db.exec("create role anon; create role authenticated; create role service_role;");
      await db.exec(readFileSync("supabase/migrations/20260909080757_kakao_cs_conversations.sql", "utf8"));
      const claim = async (session: string, req: string) => (await db.query<{result:{status:string;messages?:unknown[]}}>("select claim_kakao_cs_conversation($1,$2,'00000000-0000-4000-8000-000000000001') as result", [session,req])).rows[0].result;
      expect((await claim("A","r1")).status).toBe("claimed");
      expect((await claim("A","r1")).status).toBe("duplicate");
      expect((await claim("A","r2")).status).toBe("busy");
      expect((await claim("B","r2")).messages).toEqual([]);
      await db.exec("update kakao_cs_conversations set paused=true where session_key='A'");
      expect((await claim("A","r3")).status).toBe("paused");
      await db.exec("set role anon;");
      await expect(db.query("select * from kakao_cs_conversations")).rejects.toThrow();
      await expect(claim("X","r1")).rejects.toThrow();
    } finally { await db.close(); }
  });
});
