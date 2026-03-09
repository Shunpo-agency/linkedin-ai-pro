import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/shared/types/database.types'

/**
 * Service role client — bypasses RLS.
 * Only use in server-side code (webhooks, workers, server actions).
 * Never expose to client.
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
