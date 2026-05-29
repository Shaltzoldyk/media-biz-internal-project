// lib/automationEngine.ts
import { supabaseServer as supabase } from "@/lib/supabaseServer"
import { calculateLeadAgingDistribution } from "@/lib/leadAgingEngine"
import { getAdaptiveRevenueDropThreshold } from "@/lib/adaptiveThresholdEngine"
import { getAdaptiveStageThreshold } from "@/lib/adaptivePipelineThresholdEngine"
import { handleStalledOutreachLeads, resolveOutreachAlerts } from "@/lib/outreachAutomation"
import type { LeadRow, RevenueRow } from "@/lib/intelligenceRunner"

const HIGH_VALUE_THRESHOLD   = 5000
const STALLED_DAYS_THRESHOLD = 5
const ESCALATION_DAYS        = 3
const MIN_STAGE_SAMPLE_SIZE  = 5
const AGING_RISK_THRESHOLD   = 0.35

/* ================================
   PUBLIC RUNNER
================================ */

export async function runAutomationCycle(
  leads:   LeadRow[],
  revenue: RevenueRow[]
) {
  await resolveStaleAutomations(leads, revenue)

  await Promise.all([
    handleStalledHighValueLeads(leads),
    handleRevenueDropDetection(revenue),
    handleStageBottlenecks(leads),
    handleAgingRisk(leads),
    escalateUnresolvedAutomations(),
    handleStalledOutreachLeads(leads),
    resolveOutreachAlerts(),
  ])
}

/* ================================
   RESOLUTION PASS
   FIX: use revenue_date (actual payment date) not created_at
   (row insertion date) when checking if revenue drop still holds.
================================ */

async function resolveStaleAutomations(leads: LeadRow[], revenue: RevenueRow[]) {
  const { data: open } = await supabase
    .from("automations_log")
    .select("id, type, entity_id, created_at")
    .eq("resolved", false)

  if (!open || open.length === 0) return

  const now = new Date()

  const stalledHighValueIds = new Set(
    leads
      .filter((lead) => {
        if (!lead.value || Number(lead.value) < HIGH_VALUE_THRESHOLD) return false
        if (!lead.stage_changed_at) return false
        const diffDays =
          (now.getTime() - new Date(lead.stage_changed_at).getTime()) /
          (1000 * 60 * 60 * 24)
        return diffDays >= STALLED_DAYS_THRESHOLD
      })
      .map((l) => l.id)
  )

  let revenueDropStillActive = false
  if (revenue.length > 0) {
    const sevenDaysAgo    = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    let current = 0, previous = 0
    for (const r of revenue) {
      if (!r.revenue_date) continue
      const paymentDate = new Date(r.revenue_date)   // ← revenue_date, not created_at
      const amount      = Number(r.amount || 0)
      if (paymentDate >= sevenDaysAgo)         current  += amount
      else if (paymentDate >= fourteenDaysAgo) previous += amount
    }
    if (previous > 0) {
      const drop      = (previous - current) / previous
      const threshold = await getAdaptiveRevenueDropThreshold(revenue)
      revenueDropStillActive = drop > threshold
    }
  }

  const toResolve: string[] = []

  for (const alert of open) {
    let shouldResolve = false

    if (alert.type === "stalled_high_value_lead") {
      shouldResolve = alert.entity_id ? !stalledHighValueIds.has(alert.entity_id) : false
    } else if (alert.type === "revenue_drop") {
      shouldResolve = !revenueDropStillActive
    } else if (alert.type === "stage_bottleneck" || alert.type === "aging_risk") {
      const ageHours =
        (now.getTime() - new Date(alert.created_at).getTime()) / (1000 * 60 * 60)
      shouldResolve = ageHours >= 24
    }

    if (shouldResolve) toResolve.push(alert.id)
  }

  if (toResolve.length === 0) return

  await supabase
    .from("automations_log")
    .update({ resolved: true, resolved_at: now.toISOString() })
    .in("id", toResolve)
}

/* ================================
   STALLED HIGH VALUE LEADS
================================ */

async function handleStalledHighValueLeads(leads: LeadRow[]) {
  const now = new Date()

  const stalled = leads.filter((lead) => {
    if (!lead.value || Number(lead.value) < HIGH_VALUE_THRESHOLD) return false
    if (!lead.stage_changed_at) return false
    const diffDays =
      (now.getTime() - new Date(lead.stage_changed_at).getTime()) /
      (1000 * 60 * 60 * 24)
    return diffDays >= STALLED_DAYS_THRESHOLD
  })

  if (stalled.length === 0) return

  const { data: existing } = await supabase
    .from("automations_log")
    .select("entity_id")
    .eq("type", "stalled_high_value_lead")
    .eq("resolved", false)
    .in("entity_id", stalled.map((l) => l.id))

  const alreadyFlagged = new Set((existing || []).map((r) => r.entity_id))

  const jobs = stalled
    .filter((lead) => !alreadyFlagged.has(lead.id))
    .map((lead) => {
      const diffDays =
        (now.getTime() - new Date(lead.stage_changed_at!).getTime()) /
        (1000 * 60 * 60 * 24)

      return Promise.all([
        supabase.from("automations_log").insert({
          type:        "stalled_high_value_lead",
          entity_type: "lead",
          entity_id:   lead.id,
          severity:    "high",
        }),
        supabase.from("activities").insert({
          entity_type: "lead",
          entity_id:   lead.id,
          type:        "system_flag",
          message:     `High-value lead stalled for ${Math.floor(diffDays)} days.`,
          severity:    "high",
          metadata: {
            daysInStage: Math.floor(diffDays),
            threshold:   STALLED_DAYS_THRESHOLD,
            value:       lead.value,
          },
          created_at: new Date().toISOString(),
        }),
      ])
    })

  await Promise.all(jobs)
}

/* ================================
   REVENUE DROP DETECTION (Adaptive)
   FIX: use revenue_date (actual payment date) not created_at.
================================ */

async function handleRevenueDropDetection(revenue: RevenueRow[]) {
  if (!revenue || revenue.length === 0) return

  const now             = new Date()
  const sevenDaysAgo    = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  let currentWindow  = 0
  let previousWindow = 0

  for (const record of revenue) {
    if (!record.revenue_date) continue
    const paymentDate = new Date(record.revenue_date)  // ← revenue_date, not created_at
    const amount      = Number(record.amount || 0)
    if (paymentDate >= sevenDaysAgo)         currentWindow  += amount
    else if (paymentDate >= fourteenDaysAgo) previousWindow += amount
  }

  if (previousWindow === 0) return

  const percentDrop       = (previousWindow - currentWindow) / previousWindow
  const adaptiveThreshold = await getAdaptiveRevenueDropThreshold(revenue)

  if (percentDrop <= adaptiveThreshold) return

  const severity = percentDrop > adaptiveThreshold * 2 ? "critical" : "high"

  const { data: existing } = await supabase
    .from("automations_log")
    .select("id")
    .eq("type", "revenue_drop")
    .eq("resolved", false)
    .maybeSingle()

  if (existing) return

  await Promise.all([
    supabase.from("automations_log").insert({
      type:        "revenue_drop",
      entity_type: "system",
      entity_id:   null,
      severity,
    }),
    supabase.from("activities").insert({
      entity_type: "system",
      entity_id:   null,
      type:        "system_flag",
      message:     `Revenue dropped ${Math.round(percentDrop * 100)}% compared to previous 7 days.`,
      severity,
      metadata:    { currentWindow, previousWindow, percentDrop, adaptiveThreshold },
      created_at:  new Date().toISOString(),
    }),
  ])
}

/* ================================
   STAGE BOTTLENECK DETECTION (Adaptive)
================================ */

async function handleStageBottlenecks(leads: LeadRow[]) {
  if (!leads || leads.length === 0) return

  const adaptiveThreshold = await getAdaptiveStageThreshold(leads)

  const stageTotals: Record<string, number> = {}
  let totalConverted = 0
  let totalActive    = 0

  for (const lead of leads) {
    const stage = lead.status
    if (!stage) continue
    stageTotals[stage] = (stageTotals[stage] || 0) + 1
    if (lead.converted === true) totalConverted++
    if (stage !== "Client" && stage !== "Lost") totalActive++
  }

  const stageConversions: Record<string, number> = {}
  const nonTerminalStages = Object.keys(stageTotals).filter(
    (s) => s !== "Client" && s !== "Lost"
  )

  for (const stage of nonTerminalStages) {
    stageConversions[stage] =
      totalActive > 0 ? totalConverted * (stageTotals[stage] / totalActive) : 0
  }

  const bottleneckStages = nonTerminalStages.filter((stage) => {
    const total = stageTotals[stage]
    if (total < MIN_STAGE_SAMPLE_SIZE) return false
    const rate = (stageConversions[stage] || 0) / total
    return rate < adaptiveThreshold
  })

  if (bottleneckStages.length === 0) return

  const { data: existing } = await supabase
    .from("automations_log")
    .select("stage_name")
    .eq("type", "stage_bottleneck")
    .eq("entity_type", "system")
    .eq("resolved", false)
    .in("stage_name", bottleneckStages)

  const alreadyFlagged = new Set((existing || []).map((r) => r.stage_name))

  const jobs = bottleneckStages
    .filter((stage) => !alreadyFlagged.has(stage))
    .map((stage) => {
      const total = stageTotals[stage]
      const rate  = (stageConversions[stage] || 0) / total

      return Promise.all([
        supabase.from("automations_log").insert({
          type:        "stage_bottleneck",
          entity_type: "system",
          entity_id:   null,
          severity:    "high",
          stage_name:  stage,
        }),
        supabase.from("activities").insert({
          entity_type: "system",
          entity_id:   null,
          type:        "system_flag",
          message:     `Stage "${stage}" conversion rate dropped to ${(rate * 100).toFixed(1)}%.`,
          severity:    "high",
          metadata:    { stage, conversionRate: rate, sampleSize: total, adaptiveThreshold },
          created_at:  new Date().toISOString(),
        }),
      ])
    })

  await Promise.all(jobs)
}

/* ================================
   AGING RISK DETECTION
================================ */

async function handleAgingRisk(leads: LeadRow[]) {
  const aging = await calculateLeadAgingDistribution(leads)
  if (!aging || aging.structuralRiskScore === undefined) return

  if (aging.structuralRiskScore < AGING_RISK_THRESHOLD) return

  const { data: existing } = await supabase
    .from("automations_log")
    .select("id")
    .eq("type", "aging_risk")
    .eq("resolved", false)
    .maybeSingle()

  if (existing) return

  await Promise.all([
    supabase.from("automations_log").insert({
      type:        "aging_risk",
      entity_type: "system",
      entity_id:   null,
      severity:    "high",
    }),
    supabase.from("activities").insert({
      entity_type: "system",
      entity_id:   null,
      type:        "system_flag",
      message:     "Structural aging risk detected in pipeline.",
      severity:    "high",
      metadata: {
        buckets:             aging.buckets,
        structuralRiskScore: aging.structuralRiskScore,
        threshold:           AGING_RISK_THRESHOLD,
      },
      created_at: new Date().toISOString(),
    }),
  ])
}

/* ================================
   ESCALATION ENGINE
================================ */

async function escalateUnresolvedAutomations() {
  const { data: openAutomations } = await supabase
    .from("automations_log")
    .select("id, severity, created_at, entity_type, entity_id")
    .eq("resolved", false)

  if (!openAutomations || openAutomations.length === 0) return

  const now = new Date()

  const toHigh:          string[] = []
  const toCritical:      string[] = []
  const activityInserts: object[] = []

  for (const automation of openAutomations) {
    if (!automation.created_at) continue
    if (automation.severity === "critical") continue

    const diffDays =
      (now.getTime() - new Date(automation.created_at).getTime()) /
      (1000 * 60 * 60 * 24)

    if (diffDays < ESCALATION_DAYS) continue

    const newSeverity = automation.severity === "high" ? "critical" : "high"
    if (newSeverity === "critical") toCritical.push(automation.id)
    else                            toHigh.push(automation.id)

    activityInserts.push({
      entity_type: automation.entity_type,
      entity_id:   automation.entity_id,
      type:        "system_flag",
      message:     `Automation escalated to ${newSeverity}.`,
      severity:    newSeverity,
      metadata: {
        escalatedFrom:      automation.severity,
        escalatedAfterDays: Math.floor(diffDays),
      },
      created_at: new Date().toISOString(),
    })
  }

  await Promise.all([
    toCritical.length > 0
      ? supabase.from("automations_log").update({ severity: "critical" }).in("id", toCritical)
      : Promise.resolve(),
    toHigh.length > 0
      ? supabase.from("automations_log").update({ severity: "high" }).in("id", toHigh)
      : Promise.resolve(),
    activityInserts.length > 0
      ? supabase.from("activities").insert(activityInserts)
      : Promise.resolve(),
  ])
}