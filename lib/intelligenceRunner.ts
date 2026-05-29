// lib/intelligenceRunner.ts
import { runPipelineHealthSnapshot } from "./pipelineHealthSnapshotEngine"
import { supabaseServer as supabase } from "@/lib/supabaseServer"
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
import { runAutomationCycle } from "./automationEngine"
import { calculatePipelineHealth } from "./pipelineHealthEngine"

/* ================================
   SEVERITY RANKING
================================ */

const severityRank: Record<StuckSeverity | ClientRiskSeverity, number> = {
  warning: 1,
  high: 2,
  critical: 3,
}

/* ================================
   SHARED DATA TYPES
================================ */

export type LeadRow = Pick<
  Lead,
  | "id"
  | "status"
  | "stage_changed_at"
  | "follow_up_date"
  | "value"
  | "converted"
  | "stage_at_conversion"
>

export type ClientRow = {
  id: string
  name: string
  billing_type: string | null
  start_date: string | null
  status: string | null
}

export type RevenueRow = {
  id: string
  client_id: string
  amount: number
  // revenue_date is the canonical "when did this payment occur" field.
  // Use this for all date-based revenue logic — it represents the actual
  // payment date and can be backdated. created_at is when the row was
  // inserted and is not meaningful for business calculations.
  revenue_date: string
  created_at: string
}

/* ================================
   SINGLE SHARED FETCH
================================ */

async function fetchSharedData() {
  // FIX: revenue_records scoped to the last 90 days by revenue_date.
  // Previously fetched the entire table on every cron cycle.
  // 90 days covers:
  //   • monthly billing anniversary checks (max 31 days lookback)
  //   • revenue drop detection (max 14 days lookback)
  //   • any reasonable trend analysis
  const ninetyDaysAgo = new Date(
    Date.now() - 90 * 24 * 60 * 60 * 1000
  ).toISOString()

  const [{ data: leads }, { data: clients }, { data: revenue }] =
    await Promise.all([
      supabase
        .from("leads")
        .select("id, status, stage_changed_at, follow_up_date, value, converted, stage_at_conversion"),
      supabase
        .from("clients")
        .select("id, name, billing_type, start_date, status"),
      supabase
        .from("revenue_records")
        .select("id, client_id, amount, revenue_date, created_at")
        .gte("revenue_date", ninetyDaysAgo),
    ])

  return {
    leads:   (leads   || []) as LeadRow[],
    clients: (clients || []) as ClientRow[],
    revenue: (revenue || []) as RevenueRow[],
  }
}

/* ================================
   PUBLIC RUNNER (CALL THIS)
================================ */

export async function runIntelligenceChecks() {
  const shared = await fetchSharedData()

  await Promise.all([
    runStuckLeadCheck(shared.leads),
    runClientRiskCheck(shared.clients, shared.revenue),
    runSystemHealthSnapshot(shared.leads, shared.clients, shared.revenue),
    runPipelineHealthSnapshot(),
    runAutomationCycle(shared.leads, shared.revenue),
  ])
}

/* ================================
   STUCK LEAD CHECK
================================ */

async function runStuckLeadCheck(leads: LeadRow[]) {
  const stuckLeads = detectStuckLeads(leads as Lead[], 5)
  if (stuckLeads.length === 0) return

  const stuckIds = stuckLeads.map((l) => l.leadId)

  const { data: recentFlags } = await supabase
    .from("activities")
    .select("entity_id, severity")
    .eq("entity_type", "lead")
    .eq("type", "system_flag")
    .in("entity_id", stuckIds)
    .order("created_at", { ascending: false })

  const lastSeverityMap = new Map<string, string>()
  for (const row of recentFlags || []) {
    if (!lastSeverityMap.has(row.entity_id)) {
      lastSeverityMap.set(row.entity_id, row.severity)
    }
  }

  const inserts: Promise<void>[] = []

  for (const lead of stuckLeads) {
    const lastSeverity = lastSeverityMap.get(lead.leadId) as StuckSeverity | undefined
    const shouldLog =
      !lastSeverity || severityRank[lead.severity] > severityRank[lastSeverity]

    if (!shouldLog) continue

    inserts.push(
      logActivity({
        entityType: "lead",
        entityId:   lead.leadId,
        type:       "system_flag",
        message:    `Lead stuck (${lead.daysInStage} days in stage)`,
        severity:   lead.severity,
        metadata:   { stage: lead.stage, daysInStage: lead.daysInStage },
      })
    )
  }

  await Promise.all(inserts)
}

/* ================================
   CLIENT REVENUE RISK CHECK
================================ */

async function runClientRiskCheck(clients: ClientRow[], revenue: RevenueRow[]) {
  const atRiskClients = detectAtRiskClients(clients, revenue)
  if (atRiskClients.length === 0) return

  const atRiskIds = atRiskClients.map((c) => c.clientId)

  const { data: recentFlags } = await supabase
    .from("activities")
    .select("entity_id, severity")
    .eq("entity_type", "client")
    .eq("type", "system_flag")
    .in("entity_id", atRiskIds)
    .order("created_at", { ascending: false })

  const lastSeverityMap = new Map<string, string>()
  for (const row of recentFlags || []) {
    if (!lastSeverityMap.has(row.entity_id)) {
      lastSeverityMap.set(row.entity_id, row.severity)
    }
  }

  const inserts: Promise<void>[] = []

  for (const client of atRiskClients) {
    const lastSeverity = lastSeverityMap.get(client.clientId) as ClientRiskSeverity | undefined
    const shouldLog =
      !lastSeverity || severityRank[client.severity] > severityRank[lastSeverity]

    if (!shouldLog) continue

    inserts.push(
      logActivity({
        entityType: "client",
        entityId:   client.clientId,
        type:       "system_flag",
        message:    `Client payment overdue (${client.daysOverdue} days)`,
        severity:   client.severity,
        metadata:   { daysOverdue: client.daysOverdue },
      })
    )
  }

  await Promise.all(inserts)
}

/* ================================
   SYSTEM HEALTH SNAPSHOT
================================ */

async function runSystemHealthSnapshot(
  leads:   LeadRow[],
  clients: ClientRow[],
  revenue: RevenueRow[]
) {
  const todayStr = new Date().toISOString().split("T")[0]

  const { data: existing } = await supabase
    .from("system_health_snapshots")
    .select("id")
    .eq("snapshot_date", todayStr)
    .limit(1)

  if (existing && existing.length > 0) return

  const stuckLeads = detectStuckLeads(leads as Lead[])
  const overdue    = detectOverdueFollowUps(leads as Lead[])
  const atRisk     = detectAtRiskClients(clients, revenue)
  const health     = calculateSystemHealth(stuckLeads, overdue, atRisk)

  await supabase.from("system_health_snapshots").insert({
    score:           health.score,
    stuck_penalty:   health.breakdown.stuckPenalty,
    overdue_penalty: health.breakdown.overduePenalty,
    revenue_penalty: health.breakdown.revenuePenalty,
    snapshot_date:   todayStr,
  })
}

/* ================================
   PIPELINE HEALTH SNAPSHOT
   FIX: Dashboard now reads from this table rather than calling
   calculatePipelineHealth() live on every page render. The cron
   writes once per day; the page is a pure read.
================================ */