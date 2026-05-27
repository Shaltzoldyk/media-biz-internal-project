// app/api/outreach/import/route.ts
//
// POST — inserts an array of YTLeadCandidate into the leads table.
// Skips any channel URL already present in leads (dedup by yt_channel_url).
// Returns { ok, imported, skipped }.

import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { calculateLeadScore } from "@/lib/leadScore"
import type { YTLeadCandidate } from "@/lib/ytDiscovery"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const candidates: YTLeadCandidate[] = body.leads ?? []
  if (!candidates.length) {
    return NextResponse.json({ ok: false, error: "No leads provided" }, { status: 400 })
  }

  // Fetch already-imported channel URLs so we can skip duplicates
  const { data: existing } = await supabase
    .from("leads")
    .select("yt_channel_url")
    .not("yt_channel_url", "is", null)

  const existingUrls = new Set(
    (existing ?? []).map((r) => r.yt_channel_url).filter(Boolean)
  )

  const now      = new Date().toISOString()
  const toInsert = []
  let skipped    = 0

  for (const c of candidates) {
    if (existingUrls.has(c.channelUrl)) {
      skipped++
      continue
    }

    // Derive signal_uploads_weekly from uploads30d (4+ uploads = weekly cadence)
    const uploadsWeekly = c.uploads30d >= 4

    const score = calculateLeadScore({
      subscribers:   c.subscribers,
      outsourcing:   false,       // unknown at discovery time
      uploadsWeekly,
      monetized:     false,       // unknown at discovery time
      warmIntro:     false,       // cold outreach by definition
      ytUploads30d:  c.uploads30d,
      ytAvgViews:    c.avgViews,
    })

    toInsert.push({
      name:                  c.channelName,
      brand_name:            c.channelName,
      platform:              "YouTube",
      subscriber_count:      c.subscribers,
      status:                "Outreach",
      stage_changed_at:      now,
      score,
      // YT-specific fields
      yt_channel_url:        c.channelUrl,
      yt_avg_views:          c.avgViews,
      yt_uploads_30d:        c.uploads30d,
      yt_score:              c.ytScore,
      // Scoring signals
      signal_warm_intro:     false,
      signal_outsourcing:    false,
      signal_uploads_weekly: uploadsWeekly,
      signal_monetized:      false,
      // value left null — set manually once a deal is scoped
      value: null,
    })
  }

  if (!toInsert.length) {
    return NextResponse.json({ ok: true, imported: 0, skipped })
  }

  const { error } = await supabase.from("leads").insert(toInsert)
  if (error) {
    console.error("Import insert failed:", error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, imported: toInsert.length, skipped })
}
