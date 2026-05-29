// lib/supabaseServer.ts
//
// Server-only Supabase client (service role key — bypasses RLS).
//
// ✅ Import in: API routes, lib/ engines, server components
// ❌ Never import in "use client" components
//
// The client is created LAZILY — only on first use, not at module load.
// This means next build never throws due to a missing env var; the error
// surfaces at request time instead, which is the correct Next.js behaviour.

import { createClient, SupabaseClient } from "@supabase/supabase-js"

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL) is not set. " +
      "Add it to .env.local — never prefix the service key with NEXT_PUBLIC_."
    )
  }

  _client = createClient(url, key, {
    auth: {
      persistSession:   false,  // service client never needs a session
      autoRefreshToken: false,
    },
  })

  return _client
}

// Proxy so all existing imports (`supabaseServer.from(...)` etc.) work
// without any call-site changes. Methods are bound to the real instance.
export const supabaseServer = new Proxy({} as SupabaseClient, {
  get(_: SupabaseClient, prop: string | symbol) {
    const instance = getClient()
    const value    = (instance as any)[prop]
    return typeof value === "function" ? value.bind(instance) : value
  },
})