import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { AdminPageClient } from "@/features/admin/AdminPageClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const initialAuthenticated = isAdminSessionTokenValid(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  );

  return <AdminPageClient initialAuthenticated={initialAuthenticated} />;
}
