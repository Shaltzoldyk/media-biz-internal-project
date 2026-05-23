import { supabase } from "@/lib/supabase"

const SMOOTHING_FACTOR = 2 // prevents zero-probability collapse
const DEFAULT_FALLBACK_PROB = 0.1

export async function calculatePredictivePipeline() {
  const { data: leads } = await supabase
    .from("leads")
    .select("id, status, stage_changed_at, value, converted, stage_at_conversion")

  if (!leads || leads.length === 0) {
    return {
      totalExpectedValue: 0,
      leads: [],
      stageProbabilities: {},
    }
  }

  const now = new Date()

  /* ==========================================
     Learn Historical Conversion Probabilities
     ========================================== */

  const stageTotals: Record<string, number> = {}
  let totalConverted = 0
  let totalActive = 0

  for (const lead of leads) {
    const stage = lead.status
    if (!stage) continue

    if (stage !== "Client" && stage !== "Lost") {
      stageTotals[stage] = (stageTotals[stage] || 0) + 1
      totalActive++
    }

    if (lead.converted === true) totalConverted++
  }

  const stageProbabilities: Record<string, number> = {}

  for (const stage in stageTotals) {
    const total = stageTotals[stage]

    // Proportional win attribution with Bayesian smoothing
    const stageWins =
      totalActive > 0
        ? totalConverted * (total / totalActive)
        : 0

    // Bayesian smoothing prevents 0% collapse
    stageProbabilities[stage] =
      (stageWins + SMOOTHING_FACTOR) /
      (total + SMOOTHING_FACTOR * 2)
  }

  /* ==========================================
     Score Active Leads
     ========================================== */

  const activeLeads = leads.filter(
    (lead) =>
      lead.status !== "Client" &&
      lead.status !== "Lost"
  )

  const enrichedLeads = activeLeads.map(
    (lead) => {
      const baseProb =
        stageProbabilities[lead.status] ??
        DEFAULT_FALLBACK_PROB

      let daysInStage = 0

      if (lead.stage_changed_at) {
        const changed = new Date(
          lead.stage_changed_at
        )

        daysInStage =
          (now.getTime() - changed.getTime()) /
          (1000 * 60 * 60 * 24)
      }

      const velocityPenalty = Math.min(
        daysInStage / 30,
        0.3
      )

      const probability =
        baseProb * (1 - velocityPenalty)

      const expectedValue =
        Number(lead.value || 0) *
        probability

      return {
        ...lead,
        probability,
        expectedValue,
        daysInStage,
      }
    }
  )

  const totalExpectedValue =
    enrichedLeads.reduce(
      (sum, lead) =>
        sum + lead.expectedValue,
      0
    )

  return {
    totalExpectedValue,
    leads: enrichedLeads,
    stageProbabilities,
  }
}
