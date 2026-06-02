// app/api/outreach/send/route.ts
//
// POST — sends one personalised outreach email, creates the lead in DB
// (upsert by yt_channel_url), writes to outreach_log, logs activity.
//
// Called from the Outreach page UI — no cron auth needed.
// Rate-limited to 30 sends per hour (mirrors Python MAX_EMAILS = 30).

import { NextRequest, NextResponse } from "next/server"
import { sendOutreachEmail }         from "@/lib/ytOutreach"
import { supabaseServer as supabase } from "@/lib/supabaseServer"
import { logActivity }               from "@/lib/activity"
import { calculateLeadScore }        from "@/lib/leadScore"

export const dynamic = "force-dynamic"

const HOURLY_LIMIT = 30

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const {
    emailAddress,
    channelName,
    channelUrl,
    subscribers  = 0,
    uploads30d   = 0,
    avgViews     = 0,
    lastUpload   = "",
    ytScore      = 0,
  } = body

  if (!emailAddress || !channelUrl || !channelName) {
    return NextResponse.json(
      { ok: false, error: "emailAddress, channelName, channelUrl are required" },
      { status: 400 }
    )
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from("outreach_log")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", oneHourAgo)

  if ((count ?? 0) >= HOURLY_LIMIT) {
    return NextResponse.json(
      { ok: false, error: `Hourly limit of ${HOURLY_LIMIT} emails reached. Try again later.` },
      { status: 429 }
    )
  }

  // ── Get or create lead ────────────────────────────────────────────────────
  // Upsert by yt_channel_url — safe to call even if already imported.
  let leadId: string

  const { data: existingLead } = await supabase
    .from("leads")
    .select("id")
    .eq("yt_channel_url", channelUrl)
    .maybeSingle()

  if (existingLead) {
    leadId = existingLead.id
  } else {
    const uploadsWeekly = uploads30d >= 4
    const score = calculateLeadScore({
      subscribers, outsourcing: false, uploadsWeekly,
      monetized: false, warmIntro: false,
      ytUploads30d: uploads30d, ytAvgViews: avgViews,
    })

    const { data: newLead, error: insertError } = await supabase
      .from("leads")
      .insert({
        name:                  channelName,
        brand_name:            channelName,
        platform:              "YouTube",
        subscriber_count:      subscribers,
        status:                "Outreach",
        stage_changed_at:      new Date().toISOString(),
        score,
        yt_channel_url:        channelUrl,
        yt_avg_views:          avgViews,
        yt_uploads_30d:        uploads30d,
        yt_score:              ytScore,
        signal_warm_intro:     false,
        signal_outsourcing:    false,
        signal_uploads_weekly: uploadsWeekly,
        signal_monetized:      false,
        value:                 null,
      })
      .select("id")
      .single()

    if (insertError || !newLead) {
      return NextResponse.json(
        { ok: false, error: insertError?.message ?? "Failed to create lead" },
        { status: 500 }
      )
    }
    leadId = newLead.id
  }

  // ── Dedup — don't send twice to same lead ─────────────────────────────────
  const { data: alreadySent } = await supabase
    .from("outreach_log")
    .select("id")
    .eq("lead_id", leadId)
    .in("status", ["sent", "replied"])
    .limit(1)

  if (alreadySent && alreadySent.length > 0) {
    return NextResponse.json(
      { ok: false, error: "Email already sent to this channel" },
      { status: 409 }
    )
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  const result = await sendOutreachEmail({ to: emailAddress, channelUrl, uploads30d })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  const sentAt = new Date().toISOString()

  await Promise.all([
    supabase.from("outreach_log").insert({
      lead_id:       leadId,
      email_address: emailAddress,
      subject:       result.subject,
      status:        "sent",
      sent_at:       sentAt,
      video_title:   result.videoTitle,
    }),
    logActivity({
      entityType: "lead",
      entityId:   leadId,
      type:       "outreach_sent",
      message:    `Outreach email sent to ${emailAddress}`,
      metadata:   { emailAddress, subject: result.subject, videoTitle: result.videoTitle },
    }),
  ])

  return NextResponse.json({ ok: true, leadId, subject: result.subject, videoTitle: result.videoTitle })
}