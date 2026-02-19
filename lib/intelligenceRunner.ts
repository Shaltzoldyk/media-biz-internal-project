import { supabase } from "@/lib/supabase"
import {
  detectStuckLeads,
  detectAtRiskClients,
  detectOverdueFollowUps,
  calculateSystemHealth,
  StuckSeverity,
  ClientRiskSeverity,
} from "./intelligence"
import { Lead } from "@/types/lead"
import { logActivity } from "./activity"

/* ================================
   SEVERITY RANKING
================================ */

const severityRank: Record<
  StuckSeverity | ClientRiskSeverity,
  number
> = {
  warning: 1,
  high: 2,
  critical: 3,
}

/* ================================
   PUBLIC RUNNER (CALL THIS)
================================ */

export async function runIntelligenceChecks() {
  await runStuckLeadCheck()
  await runClientRiskCheck()
  await runSystemHealthSnapshot()
}

/* ================================
   STUCK LEAD CHECK
================================ */

async function runStuckLeadCheck() {
  const { data } = await supabase
    .from("leads")
    .select("*")

  const leads = (data || []) as Lead[]

  const stuckLeads = detectStuckLeads(
    leads,
    5
  )

  for (const lead of stuckLeads) {
    const { data: existing } =
      await supabase
        .from("activities")
        .select("severity")
        .eq("entity_type", "lead")
        .eq("entity_id", lead.leadId)
        .eq("type", "system_flag")
        .order("created_at", {
          ascending: false,
        })
        .limit(1)

    let shouldLog = false

    if (!existing || existing.length === 0) {
      shouldLog = true
    } else {
      const lastSeverity =
        existing[0].severity as
          | StuckSeverity
          | null

      if (
        !lastSeverity ||
        severityRank[lead.severity] >
          severityRank[lastSeverity]
      ) {
        shouldLog = true
      }
    }

    if (shouldLog) {
      await logActivity({
        entityType: "lead",
        entityId: lead.leadId,
        type: "system_flag",
        message: `Lead stuck (${lead.daysInStage} days in stage)`,
        severity: lead.severity,
        metadata: {
          stage: lead.stage,
          daysInStage:
            lead.daysInStage,
        },
      })
    }
  }
}

/* ================================
   CLIENT REVENUE RISK CHECK
================================ */

async function runClientRiskCheck() {
  const { data: clients } =
    await supabase
      .from("clients")
      .select("*")

  const { data: revenueRecords } =
    await supabase
      .from("revenue_records")
      .select("*")

  if (!clients || !revenueRecords)
    return

  const atRiskClients =
    detectAtRiskClients(
      clients,
      revenueRecords
    )

  for (const client of atRiskClients) {
    const { data: existing } =
      await supabase
        .from("activities")
        .select("severity")
        .eq("entity_type", "client")
        .eq("entity_id", client.clientId)
        .eq("type", "system_flag")
        .order("created_at", {
          ascending: false,
        })
        .limit(1)

    let shouldLog = false

    if (!existing || existing.length === 0) {
      shouldLog = true
    } else {
      const lastSeverity =
        existing[0].severity as
          | ClientRiskSeverity
          | null

      if (
        !lastSeverity ||
        severityRank[client.severity] >
          severityRank[lastSeverity]
      ) {
        shouldLog = true
      }
    }

    if (shouldLog) {
      await logActivity({
        entityType: "client",
        entityId: client.clientId,
        type: "system_flag",
        message: `Client payment overdue (${client.daysOverdue} days)`,
        severity: client.severity,
        metadata: {
          daysOverdue:
            client.daysOverdue,
        },
      })
    }
  }
}

/* ================================
   SYSTEM HEALTH SNAPSHOT
================================ */

async function runSystemHealthSnapshot() {
  const todayStr = new Date()
    .toISOString()
    .split("T")[0]

  const { data: existing } =
    await supabase
      .from("system_health_snapshots")
      .select("id")
      .eq("snapshot_date", todayStr)
      .limit(1)

  if (existing && existing.length > 0) {
    return // snapshot already exists today
  }

  const { data: leads } =
    await supabase.from("leads").select("*")

  const { data: clients } =
    await supabase.from("clients").select("*")

  const { data: revenue } =
    await supabase
      .from("revenue_records")
      .select("*")

  const stuckLeads =
    detectStuckLeads(leads || [])

  const overdue =
    detectOverdueFollowUps(leads || [])

  const atRisk =
    detectAtRiskClients(
      clients || [],
      revenue || []
    )

  const health =
    calculateSystemHealth(
      stuckLeads,
      overdue,
      atRisk
    )

  await supabase
    .from("system_health_snapshots")
    .insert({
      score: health.score,
      stuck_penalty:
        health.breakdown.stuckPenalty,
      overdue_penalty:
        health.breakdown.overduePenalty,
      revenue_penalty:
        health.breakdown.revenuePenalty,
      snapshot_date: todayStr,
    })
}
