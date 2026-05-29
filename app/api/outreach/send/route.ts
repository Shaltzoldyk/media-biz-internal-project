// app/api/outreach/send/route.ts
//
// POST — sends one personalised outreach email, writes to outreach_log, logs activity.
// Rate-limited to 30 sends per hour to mirror the original script's MAX_EMAILS = 30.

import { NextRequest, NextResponse } from "next/server"
import { sendOutreachEmail } from "@/lib/ytOutreach"
import { supabaseServer as supabase } from "@/lib/supabaseServer"
import { logActivity } from "@/lib/activity"
import { requireCronAuth } from "@/lib/apiAuth"

export const dynamic = "force-dynamic"

const HOURLY_LIMIT = 30

export async function POST(req: NextRequest) {
  const authError = requireCronAuth(req)
  if (authError) return authError

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const { leadId, channelUrl, uploads30d } = body

  if (!leadId || !channelUrl || uploads30d == null) {
    return NextResponse.json(
      { ok: false, error: "leadId, channelUrl, uploads30d are required" },
      { status: 400 }
    )
  }

  // Fetch the lead to confirm it exists
  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, yt_channel_url")
    .eq("id", leadId)
    .single()

  if (!lead) {
    return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 })
  }

  // Email address comes from the discovery result — required in the request body
  const emailAddress: string = body.emailAddress ?? ""
  if (!emailAddress) {
    return NextResponse.json(
      { ok: false, error: "emailAddress is required — pass it from the discovery result" },
      { status: 400 }
    )
  }

  // Rate limit: count sends in the last hour
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

  // Dedup: don't send twice to the same lead
  const { data: existing } = await supabase
    .from("outreach_log")
    .select("id")
    .eq("lead_id", leadId)
    .in("status", ["sent", "replied"])
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { ok: false, error: "Email already sent to this lead" },
      { status: 409 }
    )
  }

  // Send
  const result = await sendOutreachEmail({
    to:         emailAddress,
    channelUrl: channelUrl ?? "",
    uploads30d: Number(uploads30d),
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  const sentAt = new Date().toISOString()

  // Write outreach_log row and activity feed entry in parallel
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
      metadata: {
        emailAddress,
        subject:    result.subject,
        videoTitle: result.videoTitle,
      },
    }),
  ])

  return NextResponse.json({
    ok:           true,
    emailAddress,
    subject:      result.subject,
    videoTitle:   result.videoTitle,
  })
}