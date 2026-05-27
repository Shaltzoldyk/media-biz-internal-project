// lib/outreachAutomation.ts
//
// Two automation jobs that integrate with automationEngine.ts.
// Same shape as every existing job — receive pre-fetched leads, no own DB fetches
// for lead data, write to automations_log + activities on trigger.

import { supabase } from "@/lib/supabase"
import type { LeadRow } from "@/lib/intelligenceRunner"

// How many days a lead can sit in Outreach with no email sent before flagging.
// Kept low (3 days) since outreach goes cold fast.
const OUTREACH_STALL_DAYS = 3

// ─── Job 1: Flag Outreach-stage leads with no email sent ─────────────────────
//
// Mirrors handleStalledHighValueLeads in automationEngine.ts:
// - filter leads to Outreach stage
// - check which have been in stage >= OUTREACH_STALL_DAYS
// - check outreach_log to see if any email exists
// - write one alert per offending lead (dedup guard included)

export async function handleStalledOutreachLeads(leads: LeadRow[]) {
  const now = new Date()

  const outreachLeads = leads.filter(
    (l) => l.status === "Outreach" && l.stage_changed_at
  )
  if (outreachLeads.length === 0) return

  const stalled = outreachLeads.filter((lead) => {
    const diffDays =
      (now.getTime() - new Date(lead.stage_changed_at!).getTime()) /
      (1000 * 60 * 60 * 24)
    return diffDays >= OUTREACH_STALL_DAYS
  })
  if (stalled.length === 0) return

  // Check which of these already have an email sent or a reply
  const { data: sentLogs } = await supabase
    .from("outreach_log")
    .select("lead_id")
    .in("lead_id", stalled.map((l) => l.id))
    .in("status", ["sent", "replied"])

  const alreadySent = new Set((sentLogs ?? []).map((r) => r.lead_id))
  const needsAlert  = stalled.filter((l) => !alreadySent.has(l.id))
  if (needsAlert.length === 0) return

  // Dedup: don't create a new alert if one is already open for this lead
  const { data: existing } = await supabase
    .from("automations_log")
    .select("entity_id")
    .eq("type", "outreach_not_sent")
    .eq("resolved", false)
    .in("entity_id", needsAlert.map((l) => l.id))

  const alreadyFlagged = new Set((existing ?? []).map((r) => r.entity_id))

  const jobs = needsAlert
    .filter((l) => !alreadyFlagged.has(l.id))
    .map(async (lead) => {
      const diffDays =
        (now.getTime() - new Date(lead.stage_changed_at!).getTime()) /
        (1000 * 60 * 60 * 24)

      await Promise.all([
        supabase.from("automations_log").insert({
          type:        "outreach_not_sent",
          entity_type: "lead",
          entity_id:   lead.id,
          severity:    "warning",
        }),
        supabase.from("activities").insert({
          entity_type: "lead",
          entity_id:   lead.id,
          type:        "system_flag",
          severity:    "warning",
          message:     `No outreach email sent after ${Math.floor(diffDays)} days in Outreach stage.`,
          metadata: {
            daysInStage: Math.floor(diffDays),
            threshold:   OUTREACH_STALL_DAYS,
          },
          created_at: now.toISOString(),
        }),
      ])
    })

  await Promise.all(jobs)
}

// ─── Job 2: Auto-resolve outreach_not_sent when email is sent ────────────────
//
// Called every cycle after handleStalledOutreachLeads.
// Finds open outreach_not_sent alerts whose lead now has a sent/replied row
// in outreach_log, and resolves them — same pattern as resolveStaleAutomations.

export async function resolveOutreachAlerts() {
  const { data: openAlerts } = await supabase
    .from("automations_log")
    .select("id, entity_id")
    .eq("type", "outreach_not_sent")
    .eq("resolved", false)

  if (!openAlerts || openAlerts.length === 0) return

  const leadIds = openAlerts.map((a) => a.entity_id).filter(Boolean) as string[]
  if (leadIds.length === 0) return

  const { data: sentLogs } = await supabase
    .from("outreach_log")
    .select("lead_id")
    .in("lead_id", leadIds)
    .in("status", ["sent", "replied"])

  const hasSent  = new Set((sentLogs ?? []).map((r) => r.lead_id))
  const toResolve = openAlerts
    .filter((a) => a.entity_id && hasSent.has(a.entity_id))
    .map((a) => a.id)

  if (toResolve.length === 0) return

  await supabase
    .from("automations_log")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .in("id", toResolve)
}
