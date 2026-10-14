import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { fetchWithRetry } from "@/lib/supabase/retry-fetch";
import type { Database } from "@/types/database.types";

export type PublicCatalogClient = ReturnType<
  typeof createSupabaseClient<Database>
>;

let sharedClient: PublicCatalogClient | null | undefined;

/**
 * Public catalog reads deliberately avoid the cookie-bound server client. Reading
 * cookies would opt every listing and product page out of caching, and anonymous
 * catalog data is identical for every visitor, so the anon key is used directly.
 *
 * One client serves the whole process. The anon client holds no session and the
 * configuration is fixed per deployment, so building a client for every read only
 * repeated the same setup work.
 *
 * Returns null when the deployment has no Supabase configuration, which keeps a
 * disconnected preview build compiling and rendering an honest empty catalog.
 */
export function getPublicCatalogClient(): PublicCatalogClient | null {
  if (sharedClient !== undefined) return sharedClient;

  const config = getSupabasePublicConfig();

  sharedClient = config
    ? createSupabaseClient<Database>(config.url, config.publishableKey, {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
        global: { fetch: fetchWithRetry },
      })
    : null;

  return sharedClient;
}
