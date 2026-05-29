// lib/supabase.ts
//
// Browser-safe Supabase client (anon key).
//
// Use this in:
//   • Server components / pages that only READ data (Today, Dashboard, Leads list, etc.)
//   • Client components that read data scoped by RLS
//
// Do NOT use this for writes in API routes or lib/ engines.
// For server-side writes, import { supabaseServer } from "@/lib/supabaseServer"

import { createClient } from "@supabase/supabase-js"

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)