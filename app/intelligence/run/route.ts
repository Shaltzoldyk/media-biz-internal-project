import { NextResponse } from "next/server"
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

export const dynamic = "force-dynamic"

export async function GET() {
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