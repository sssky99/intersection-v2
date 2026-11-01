import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("allows the new version without rewriting existing profiles", async () => {
  const db = new PGlite();
  try {
    await db.exec("create table profiles(id integer, profile_experience_version text default 'preferences-v14', constraint profiles_profile_experience_version_check check (profile_experience_version in ('preferences-v14'))); insert into profiles(id) values(1);");
    await db.exec(readFileSync("supabase/migrations/20261101090327_signup_matching_questions_v16.sql", "utf8"));
    await db.exec("insert into profiles(id) values(2);");
    const result = await db.query("select profile_experience_version from profiles order by id");
    expect(result.rows).toEqual([{ profile_experience_version: "preferences-v14" }, { profile_experience_version: "preferences-v16" }]);
  } finally {
    await db.close();
  }
}, 20000);
