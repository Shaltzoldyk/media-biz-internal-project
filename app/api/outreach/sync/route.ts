// app/api/outreach/sync/route.ts
//
// GET — checks Gmail INBOX for replies from all "sent" contacts, updates outreach_log.
// Called by Vercel Cron every 6 hours (see vercel.json).
// Same auth guard pattern as /api/intelligence/run.

import { NextRequest, NextResponse } from "next/server"
import { checkReplies } from "@/lib/ytOutreach"
import { supabase } from "@/lib/supabase"
import { logActivity } from "@/lib/activity"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  // Auth guard — skipped in local dev, required in production
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
    // Fetch all "sent" rows — these are the ones we need to check for replies
    const { data: sentRows, error } = await supabase
      .from("outreach_log")
      .select("id, lead_id, email_address")
      .eq("status", "sent")

    if (error) throw new Error(error.message)
    if (!sentRows || sentRows.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, newReplies: 0, durationMs: Date.now() - start })
    }

    const emailAddresses = sentRows.map((r) => r.email_address)
    const replied        = await checkReplies(emailAddresses)

    if (replied.size === 0) {
      return NextResponse.json({ ok: true, checked: emailAddresses.length, newReplies: 0, durationMs: Date.now() - start })
    }

    // Update each row that has a reply
    const now         = new Date().toISOString()
    const updateJobs  = sentRows
      .filter((r) => replied.has(r.email_address))
      .map(async (row) => {
        await Promise.all([
          supabase
            .from("outreach_log")
            .update({ status: "replied", replied_at: now })
            .eq("id", row.id),
          logActivity({
            entityType: "lead",
            entityId:   row.lead_id,
            type:       "outreach_replied",
            message:    `Reply received from ${row.email_address}`,
            metadata:   { emailAddress: row.email_address },
          }),
        ])
      })

    await Promise.all(updateJobs)

    return NextResponse.json({
      ok:         true,
      checked:    emailAddresses.length,
      newReplies: replied.size,
      durationMs: Date.now() - start,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("Outreach sync failed:", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
