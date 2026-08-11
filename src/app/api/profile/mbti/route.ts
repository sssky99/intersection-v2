import { NextResponse } from "next/server";
import { mbtiOptions } from "@/data/mbti";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { mbti?: unknown }
    | null;
  const mbti = typeof body?.mbti === "string" ? body.mbti.trim().toUpperCase() : "";
  if (!mbtiOptions.includes(mbti)) {
    return NextResponse.json({ error: "Invalid MBTI" }, { status: 400 });
  }

  const { data: profile, error } = await createAdminClient()
    .from("profiles")
    .update({ mbti })
    .eq("user_id", user.id)
    .select("user_id")
    .maybeSingle();

  if (error) {
    console.error("Profile MBTI save failed:", error.code);
    return NextResponse.json({ error: "Profile unavailable" }, { status: 503 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
