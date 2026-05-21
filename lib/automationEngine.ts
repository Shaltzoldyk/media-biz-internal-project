import { supabase } from "@/lib/supabase"
import { calculateLeadAgingDistribution } from "@/lib/leadAgingEngine"
import { getAdaptiveRevenueDropThreshold } from "@/lib/adaptiveThresholdEngine"
import { getAdaptiveStageThreshold } from "@/lib/adaptivePipelineThresholdEngine"

const HIGH_VALUE_THRESHOLD = 5000
const STALLED_DAYS_THRESHOLD = 5
const ESCALATION_DAYS = 3
const MIN_STAGE_SAMPLE_SIZE = 5

export async function runAutomationCycle() {
  await handleStalledHighValueLeads()
  await handleRevenueDropDetection()
  await handleStageBottlenecks()
  await handleAgingRisk()
  await escalateUnresolvedAutomations()
}

/* ================================
   STALLED HIGH VALUE LEADS
================================ */

async function handleStalledHighValueLeads() {
  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")

  if (error || !leads) return

  const now = new Date()

  for (const lead of leads) {
    if (!lead.value || Number(lead.value) < HIGH_VALUE_THRESHOLD) continue
    if (!lead.stage_changed_at) continue

    const stageChanged = new Date(lead.stage_changed_at)
    const diffDays =
      (now.getTime() - stageChanged.getTime()) /
      (1000 * 60 * 60 * 24)

    if (diffDays < STALLED_DAYS_THRESHOLD) continue

    const { data: existing } = await supabase
      .from("automations_log")
      .select("id")
      .eq("type", "stalled_high_value_lead")
      .eq("entity_id", lead.id)
      .eq("resolved", false)
      .maybeSingle()

    if (existing) continue

    await supabase.from("automations_log").insert({
      type: "stalled_high_value_lead",
      entity_type: "lead",
      entity_id: lead.id,
      severity: "high",
    })

    await supabase.from("activities").insert({
      entity_type: "lead",
      entity_id: lead.id,
      type: "system_flag",
      message: `High-value lead stalled for ${Math.floor(diffDays)} days.`,
      severity: "high",
      metadata: {
        daysInStage: Math.floor(diffDays),
        threshold: STALLED_DAYS_THRESHOLD,
        value: lead.value,
      },
      created_at: new Date().toISOString(),
    })
  }
}

/* ================================
   REVENUE DROP DETECTION (Adaptive)
================================ */

async function handleRevenueDropDetection() {
  const now = new Date()

  const sevenDaysAgo = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000
  )

  const fourteenDaysAgo = new Date(
    now.getTime() - 14 * 24 * 60 * 60 * 1000
  )

  const { data: revenueRecords } = await supabase
    .from("revenue_records")
    .select("*")

  if (!revenueRecords || revenueRecords.length === 0) return

  let currentWindow = 0
  let previousWindow = 0

  for (const record of revenueRecords) {
    if (!record.created_at) continue

    const created = new Date(record.created_at)
    const amount = Number(record.amount || 0)

    if (created >= sevenDaysAgo) {
      currentWindow += amount
    } else if (
      created >= fourteenDaysAgo &&
      created < sevenDaysAgo
    ) {
      previousWindow += amount
    }
  }

  if (previousWindow === 0) return

  const percentDrop =
    (previousWindow - currentWindow) / previousWindow

  const adaptiveThreshold =
    await getAdaptiveRevenueDropThreshold()

  if (percentDrop <= adaptiveThreshold) return

  const severity =
    percentDrop > adaptiveThreshold * 2
      ? "critical"
      : "high"

  const { data: existing } = await supabase
    .from("automations_log")
    .select("id")
    .eq("type", "revenue_drop")
    .eq("resolved", false)
    .maybeSingle()

  if (existing) return

  await supabase.from("automations_log").insert({
    type: "revenue_drop",
    entity_type: "system",
    entity_id: null,
    severity,
  })

  await supabase.from("activities").insert({
    entity_type: "system",
    entity_id: null,
    type: "system_flag",
    message: `Revenue dropped ${Math.round(
      percentDrop * 100
    )}% compared to previous 7 days.`,
    severity,
    metadata: {
      currentWindow,
      previousWindow,
      percentDrop,
      adaptiveThreshold,
    },
    created_at: new Date().toISOString(),
  })
}

/* ================================
   STAGE BOTTLENECK DETECTION (Adaptive)
================================ */

async function handleStageBottlenecks() {
  const { data: leads } = await supabase
    .from("leads")
    .select("*")

  if (!leads) return

  const adaptiveThreshold =
    await getAdaptiveStageThreshold()

  const stageTotals: Record<string, number> = {}
  const stageConversions: Record<string, number> = {}

  // Count every lead's current stage toward stageTotals.
  // A converted lead (converted === true) is a win — we credit
  // the conversion to the stage it currently sits in (or "Client").
  // To attribute wins back to earlier stages we use the total
  // conversion count as a pool: each non-terminal stage's win rate
  // is estimated as (total converted leads) / (total non-terminal leads).
  // This is conservative but honest given we have no stage-history table.

  let totalConverted = 0
  let totalActive = 0

  for (const lead of leads) {
    const stage = lead.status
    if (!stage) continue

    stageTotals[stage] = (stageTotals[stage] || 0) + 1

    if (lead.converted === true) {
      totalConverted++
    }

    if (stage !== "Client" && stage !== "Lost") {
      totalActive++
    }
  }

  // Distribute wins proportionally across non-terminal stages
  // (equal share per stage is the least-biased estimate without history)
  const nonTerminalStages = Object.keys(stageTotals).filter(
    (s) => s !== "Client" && s !== "Lost"
  )

  for (const stage of nonTerminalStages) {
    const stageTotal = stageTotals[stage]
    if (totalActive === 0) {
      stageConversions[stage] = 0
    } else {
      // Stage's share of total wins, weighted by its proportion of active leads
      stageConversions[stage] =
        totalConverted * (stageTotal / totalActive)
    }
  }

  for (const stage in stageTotals) {
    if (stage === "Client" || stage === "Lost") continue

    const total = stageTotals[stage]
    if (total < MIN_STAGE_SAMPLE_SIZE) continue

    const conversions =
      stageConversions[stage] || 0

    const rate = conversions / total

    if (rate >= adaptiveThreshold) continue

    const { data: existing } = await supabase
      .from("automations_log")
      .select("id")
      .eq("type", "stage_bottleneck")
      .eq("entity_type", "system")
      .eq("resolved", false)
      .eq("stage_name", stage)
      .maybeSingle()

    if (existing) continue

    await supabase.from("automations_log").insert({
      type: "stage_bottleneck",
      entity_type: "system",
      entity_id: null,
      severity: "high",
      stage_name: stage,   // stored so future dedup queries can filter by it
    })

    await supabase.from("activities").insert({
      entity_type: "system",
      entity_id: null,
      type: "system_flag",
      message: `Stage "${stage}" conversion rate dropped to ${(rate * 100).toFixed(1)}%.`,
      severity: "high",
      metadata: {
        stage,
        conversionRate: rate,
        sampleSize: total,
        adaptiveThreshold,
      },
      created_at: new Date().toISOString(),
    })
  }
}

/* ================================
   AGING RISK DETECTION (Adaptive)
================================ */

async function handleAgingRisk() {
  const aging = await calculateLeadAgingDistribution()

  if (!aging || aging.structuralRiskScore === undefined)
    return

  // 🔥 Dynamic threshold (tightens as structural risk rises)
  const adaptiveAgingThreshold =
    0.25 + aging.structuralRiskScore * 0.3

  if (aging.structuralRiskScore < adaptiveAgingThreshold)
    return

  const { data: existing } = await supabase
    .from("automations_log")
    .select("id")
    .eq("type", "aging_risk")
    .eq("resolved", false)
    .maybeSingle()

  if (existing) return

  await supabase.from("automations_log").insert({
    type: "aging_risk",
    entity_type: "system",
    entity_id: null,
    severity: "high",
  })

  await supabase.from("activities").insert({
    entity_type: "system",
    entity_id: null,
    type: "system_flag",
    message: "Structural aging risk detected in pipeline.",
    severity: "high",
    metadata: {
      buckets: aging.buckets,
      structuralRiskScore: aging.structuralRiskScore,
      adaptiveAgingThreshold,
    },
    created_at: new Date().toISOString(),
  })
}

/* ================================
   ESCALATION ENGINE
================================ */

async function escalateUnresolvedAutomations() {
  const { data: openAutomations } = await supabase
    .from("automations_log")
    .select("*")
    .eq("resolved", false)

  if (!openAutomations) return

  const now = new Date()

  for (const automation of openAutomations) {
    if (!automation.created_at) continue
    if (automation.severity === "critical") continue

    const created = new Date(automation.created_at)
    const diffDays =
      (now.getTime() - created.getTime()) /
      (1000 * 60 * 60 * 24)

    if (diffDays < ESCALATION_DAYS) continue

    const newSeverity =
      automation.severity === "high"
        ? "critical"
        : "high"

    await supabase
      .from("automations_log")
      .update({ severity: newSeverity })
      .eq("id", automation.id)

    await supabase.from("activities").insert({
      entity_type: automation.entity_type,
      entity_id: automation.entity_id,
      type: "system_flag",
      message: `Automation escalated to ${newSeverity}.`,
      severity: newSeverity,
      metadata: {
        escalatedFrom: automation.severity,
        escalatedAfterDays: Math.floor(diffDays),
      },
      created_at: new Date().toISOString(),
    })
  }
}