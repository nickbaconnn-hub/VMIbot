import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, isEmailAllowed } from "@/lib/supabase/server";

// Supabase magic-link callback. Exchanges the code for a session cookie,
// then redirects to the dashboard (or /login with an error if not allowed).
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=exchange", url.origin));
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!isEmailAllowed(user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=not_allowed", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
