import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function profileName(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (
    normalized.length < 2 ||
    normalized.length > 30 ||
    /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { name?: unknown }
    | null;
  const name = profileName(body?.name);
  if (!name) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const { data: profile, error } = await createAdminClient()
    .from("profiles")
    .update({ name })
    .eq("user_id", user.id)
    .select("user_id")
    .maybeSingle();

  if (error) {
    console.error("Profile name save failed:", error.code);
    return NextResponse.json({ error: "Profile unavailable" }, { status: 503 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
