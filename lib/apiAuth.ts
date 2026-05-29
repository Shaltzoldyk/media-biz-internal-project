// lib/apiAuth.ts
//
// Shared auth guard for all internal API routes.
//
// Usage inside any route handler:
//
//   import { requireCronAuth } from "@/lib/apiAuth"
//
//   export async function GET(req: NextRequest) {
//     const authError = requireCronAuth(req)
//     if (authError) return authError
//     // ... rest of handler
//   }
//
// The same CRON_SECRET is reused across all internal routes — one env var to rotate.
// If you ever need per-route secrets, extend this to accept a specific env var name
// as a second parameter.

import { NextRequest, NextResponse } from "next/server"

export function requireCronAuth(req: NextRequest): NextResponse | null {
  // In local dev, skip the check so you can hit routes without a header.
  if (process.env.NODE_ENV !== "production") return null

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("CRON_SECRET env var is not set")
    return NextResponse.json(
      { ok: false, error: "Server misconfiguration" },
      { status: 500 }
    )
  }

  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    )
  }

  return null // auth passed
}