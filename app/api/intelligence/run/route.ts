import { NextRequest, NextResponse } from "next/server"
import { runIntelligenceChecks } from "@/lib/intelligenceRunner"
import { runPipelineHealthSnapshot } from "@/lib/pipelineHealthSnapshotEngine"

// This route is the single entry point for all background intelligence work.
//
// Call it from:
//   - Vercel Cron (vercel.json): { "path": "/api/intelligence/run", "schedule": "0 * * * *" }
//   - External cron (cURL, GitHub Actions, etc.)
//   - Manually during dev: GET http://localhost:3000/api/intelligence/run
//
// It is intentionally NOT called from page render functions — doing so fires
// N+1 Supabase queries on every page load and causes DNS errors at build time.
//
// Authentication:
//   Requires the Authorization header to match CRON_SECRET env var.
//   Vercel Cron sends this automatically when configured in vercel.json.
//   For manual calls: Authorization: Bearer <your-secret>
//   In development (NODE_ENV !== "production") the check is skipped so
//   localhost testing still works without setting the env var.

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  // Auth guard — skip only in local dev
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
    await runPipelineHealthSnapshot()

    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - start,
      ranAt: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("Intelligence run failed:", message)

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}