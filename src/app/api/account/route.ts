import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const profilePhotoBucket = "profile-photos";

async function removeProfilePhotos(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const { data: files, error: listError } = await admin.storage
    .from(profilePhotoBucket)
    .list(userId, { limit: 1000 });

  if (listError) throw listError;
  const paths = (files ?? [])
    .filter((file) => file.name && file.name !== ".emptyFolderPlaceholder")
    .map((file) => `${userId}/${file.name}`);
  if (paths.length === 0) return;

  const { error: removeError } = await admin.storage
    .from(profilePhotoBucket)
    .remove(paths);
  if (removeError) throw removeError;
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "로그인 정보를 확인하지 못했어요. 다시 로그인해주세요." },
      { status: 401 },
    );
  }

  try {
    const admin = createAdminClient();
    await removeProfilePhotos(admin, user.id);

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[account DELETE]", error);
    return NextResponse.json(
      {
        error:
          "회원 탈퇴를 완료하지 못했어요. 잠시 후 다시 시도하거나 카카오톡 채널로 문의해주세요.",
      },
      { status: 500 },
    );
  }
}
