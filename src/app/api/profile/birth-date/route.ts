import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const minimumBirthYear = 1980;
const maximumBirthYear = new Date().getFullYear() - 19;

function validBirthDate(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < minimumBirthYear || year > maximumBirthYear) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { value, year: String(year) };
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
    | { birthDate?: unknown }
    | null;
  const birthDate = validBirthDate(body?.birthDate);
  if (!birthDate) {
    return NextResponse.json({ error: "Invalid birth date" }, { status: 400 });
  }

  const { data: profile, error } = await createAdminClient()
    .from("profiles")
    .update({
      birth_date: birthDate.value,
      birth_year: birthDate.year,
    })
    .eq("user_id", user.id)
    .select("user_id")
    .maybeSingle();

  if (error) {
    console.error("Profile birth date save failed:", error.code);
    return NextResponse.json({ error: "Profile unavailable" }, { status: 503 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
