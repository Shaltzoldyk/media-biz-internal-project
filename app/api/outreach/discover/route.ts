// app/api/outreach/discover/route.ts
//
// POST — runs YT discovery and returns candidates.
// Also inserts a row into yt_discovery_runs for audit/history.

import { NextRequest, NextResponse } from "next/server"
import { discoverYTLeads } from "@/lib/ytDiscovery"
import { supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const { keyword, minSubs, maxSubs, minUploads30d, minAvgViews } = body

  if (!keyword || minSubs == null || maxSubs == null || minUploads30d == null) {
    return NextResponse.json(
      { ok: false, error: "keyword, minSubs, maxSubs, minUploads30d are required" },
      { status: 400 }
    )
  }

  try {
    const leads = await discoverYTLeads({
      keyword,
      minSubs:       Number(minSubs),
      maxSubs:       Number(maxSubs),
      minUploads30d: Number(minUploads30d),
      minAvgViews:   minAvgViews ? Number(minAvgViews) : undefined,
    })

    // Log the run — non-blocking, don't fail the request if this errors
    await supabase.from("yt_discovery_runs").insert({
      keyword,
      min_subs:       Number(minSubs),
      max_subs:       Number(maxSubs),
      min_uploads:    Number(minUploads30d),
      min_avg_views:  minAvgViews ? Number(minAvgViews) : null,
      leads_found:    leads.length,
    }).then(() => {})

    return NextResponse.json({ ok: true, leads })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("YT discovery failed:", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
