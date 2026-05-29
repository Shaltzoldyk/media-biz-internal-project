// app/api/intelligence/run/route.ts
//
// GET — single entry point for all background intelligence work.
//       Pipeline health snapshot is included inside runIntelligenceChecks().
//
// Called by:
//   - Vercel Cron (vercel.json): { "path": "/api/intelligence/run", "schedule": "0 * * * *" }
//   - Manually: GET http://localhost:3000/api/intelligence/run
//
// Auth: Authorization: Bearer <CRON_SECRET>
//       Skipped in development (NODE_ENV !== "production").

import { NextRequest, NextResponse } from "next/server"
import { runIntelligenceChecks } from "@/lib/intelligenceRunner"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const cronSecret = process.env.CRON_SECRET
    const authHeader = request.headers.get("authorization")

    if (!cronSecret) {
      console.error("CRON_SECRET env var is not set")
      return NextResponse.json({ ok: false, error: "Server misconfiguration" }, { status: 500 })
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }
  }

  const start = Date.now()

  try {
    await runIntelligenceChecks()

    return NextResponse.json({
      ok:        true,
      durationMs: Date.now() - start,
      ranAt:     new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("Intelligence run failed:", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}