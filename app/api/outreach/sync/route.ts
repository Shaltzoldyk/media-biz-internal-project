// app/api/outreach/sync/route.ts
//
// GET — checks Gmail INBOX for replies from all "sent" contacts, updates outreach_log.
// Called by Vercel Cron every 6 hours (see vercel.json).

import { NextRequest, NextResponse } from "next/server"
import { checkReplies } from "@/lib/ytOutreach"
import { supabaseServer as supabase } from "@/lib/supabaseServer"
import { logActivity } from "@/lib/activity"
import { requireCronAuth } from "@/lib/apiAuth"

export const dynamic = "force-dynamic"

type SentRow = {
  id:            string
  lead_id:       string
  email_address: string
}

export async function GET(request: NextRequest) {
  const authError = requireCronAuth(request)
  if (authError) return authError

  const start = Date.now()

  try {
    // Fetch all rows still in "sent" state — these need reply checking
    const { data: sentRows, error } = await supabase
      .from("outreach_log")
      .select("id, lead_id, email_address")
      .eq("status", "sent")

    if (error) throw new Error(error.message)
    if (!sentRows || sentRows.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, newReplies: 0, durationMs: Date.now() - start })
    }

    const rows           = sentRows as SentRow[]
    const emailAddresses = rows.map((r: SentRow) => r.email_address)
    const replied        = await checkReplies(emailAddresses)

    if (replied.size === 0) {
      return NextResponse.json({ ok: true, checked: emailAddresses.length, newReplies: 0, durationMs: Date.now() - start })
    }

    // Update replied rows + log activity in parallel
    const now        = new Date().toISOString()
    const updateJobs = rows
      .filter((r: SentRow) => replied.has(r.email_address))
      .map(async (row: SentRow) => {
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