import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses Row Level Security entirely.
 *
 * SERVER-ONLY. Never import this into a Client Component or anything that
 * could end up in a browser bundle; the service role key grants full
 * database access. Use only inside Server Actions / Route Handlers, and
 * only for operations that genuinely need elevated privilege (e.g. deleting
 * a user's Supabase Auth record on account deletion).
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
