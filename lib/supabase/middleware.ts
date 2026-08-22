import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "./config";

export async function refreshSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Validating the claims also refreshes an expired access token when a valid
  // refresh token is present. The updated cookies are forwarded to the page.
  const { data } = await supabase.auth.getClaims();

  return {
    response,
    identity: data?.claims
      ? {
          userId: typeof data.claims.sub === "string" ? data.claims.sub : null,
          phone: typeof data.claims.phone === "string" ? data.claims.phone : null,
        }
      : null,
  };
}
