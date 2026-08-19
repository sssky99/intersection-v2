import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseAlgorithmParameters } from "../../../../../lib/algorithmParameters";

export const dynamic = "force-dynamic";

type ParameterRow = {
  question_order: number;
  mode: "similar" | "different";
  position: number;
  updated_at: string | null;
};

async function currentUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function loadParameters(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("profile_algorithm_parameters")
    .select("question_order,mode,position,updated_at")
    .eq("user_id", userId)
    .order("position", { ascending: true });
  if (error) throw error;

  return ((data ?? []) as ParameterRow[]).map((row) => ({
    questionOrder: row.question_order,
    mode: row.mode,
    position: row.position,
    updatedAt: row.updated_at,
  }));
}

export async function GET() {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({
      parameters: await loadParameters(supabase, user.id),
    });
  } catch (error) {
    console.error("Algorithm parameters load failed:", error);
    return NextResponse.json(
      { error: "Algorithm parameters could not be loaded." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    parameters?: unknown;
  } | null;
  const parameters = parseAlgorithmParameters(body?.parameters);
  if (!parameters) {
    return NextResponse.json(
      { error: "Invalid algorithm parameters." },
      { status: 400 },
    );
  }

  const { error } = await supabase.rpc("replace_my_algorithm_parameters", {
    new_parameters: parameters.map((parameter) => ({
      question_order: parameter.questionOrder,
      mode: parameter.mode,
    })),
  });
  if (error) {
    console.error("Algorithm parameters save failed:", error);
    return NextResponse.json(
      { error: "Algorithm parameters could not be saved." },
      { status: 500 },
    );
  }

  try {
    return NextResponse.json({
      parameters: await loadParameters(supabase, user.id),
    });
  } catch (error) {
    console.error("Algorithm parameters reload failed:", error);
    return NextResponse.json(
      { error: "Algorithm parameters were saved but could not be reloaded." },
      { status: 500 },
    );
  }
}
