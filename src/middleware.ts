import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the Supabase auth session on every request, and gates
 * authenticated-only and signed-out-only routes. This must run in
 * middleware (not just in Server Components) because Server Components
 * cannot write cookies — only middleware and Route Handlers can.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() (not getSession()) actually validates the token
  // against Supabase rather than just reading the cookie — required for
  // the session to refresh reliably in the App Router.
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const requiresAuth = path.startsWith("/account") || path.startsWith("/welcome");
  const signedOutOnly = path === "/login" || path === "/signup";

  if (requiresAuth && !user) {
    const redirectUrl = new URL("/login", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (signedOutOnly && user) {
    // Respect ?redirect= so an already-logged-in person who lands on
    // /login or /signup (e.g. two tabs open, or clicking Follow with an
    // active session) still ends up back where they were headed, instead
    // of always being bounced to the homepage.
    const redirectParam = request.nextUrl.searchParams.get("redirect");
    const destination = redirectParam && redirectParam.startsWith("/") ? redirectParam : "/";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - image files
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
