import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

// Every Supabase email link (signup confirmation, password reset) points
// here. `next` carries where to go afterward — /welcome for first-time
// signup confirmation, /reset-password for password recovery.
//
// IMPORTANT: this verifies via `token_hash` + `type`, not the PKCE `code`
// exchange. PKCE requires the same browser that started the signup to also
// click the link (it needs a locally-stored code verifier), which silently
// fails the moment someone opens the email on their phone or in a different
// browser. token_hash verification has no such requirement — it works from
// any device. This means the Supabase email templates must be customised to
// link here with `token_hash`/`type` instead of the default
// `{{ .ConfirmationURL }}` — see the Supabase dashboard setup notes.
//
// This route MUST live in a plain `auth/callback` folder, not inside a
// parenthesized route group like `(auth)/callback` — a route group strips
// its own segment from the URL, which would silently break this path.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (code) {
    // Fallback path — kept in case anything still issues PKCE-style links.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
