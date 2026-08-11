import { NextResponse } from "next/server";
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
    | { gender?: unknown }
    | null;
  const gender = body?.gender;
  if (gender !== "여성" && gender !== "남성") {
    return NextResponse.json({ error: "Invalid gender" }, { status: 400 });
  }

  const { data: profile, error } = await createAdminClient()
    .from("profiles")
    .update({ gender })
    .eq("user_id", user.id)
    .select("user_id")
    .maybeSingle();

  if (error) {
    console.error("Profile gender save failed:", error.code);
    return NextResponse.json({ error: "Profile unavailable" }, { status: 503 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
