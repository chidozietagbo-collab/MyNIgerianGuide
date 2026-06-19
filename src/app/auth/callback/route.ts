import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Every Supabase email link (signup confirmation, password reset) points
// here. It exchanges the one-time code for a real session, then redirects
// onward. `next` carries where to go afterward — /welcome for first-time
// signup confirmation, /reset-password for password recovery.
//
// This route MUST live in a plain `auth/callback` folder, not inside a
// parenthesized route group like `(auth)/callback` — a route group strips
// its own segment from the URL, which would silently break this path.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
