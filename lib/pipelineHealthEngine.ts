import { supabase } from "@/lib/supabase"
import { calculatePredictivePipeline } from "./predictiveLeadEngine"

const STUCK_DAYS_THRESHOLD = 7
const BOTTLENECK_THRESHOLD = 0.15

export async function calculatePipelineHealth() {
  const { data: leads } = await supabase
    .from("leads")
    .select("*")

  if (!leads || leads.length === 0) {
    return { score: 100 }
  }

  const pipeline = await calculatePredictivePipeline()

  const now = new Date()

  // ===============================
  // 1. Conversion Strength (40 pts)
  // ===============================

  const stageProbs = Object.values(
    pipeline.stageProbabilities || {}
  )

  const avgConversion =
    stageProbs.length > 0
      ? stageProbs.reduce((a, b) => a + b, 0) /
        stageProbs.length
      : 0

  let score = avgConversion * 40

  // ===============================
  // 2. Bottleneck Penalty (20 pts)
  // ===============================

  const hasBottleneck = stageProbs.some(
    (prob) => prob < BOTTLENECK_THRESHOLD
  )

  if (!hasBottleneck) {
    score += 20
  }

  // ===============================
  // 3. Velocity Health (20 pts)
  // ===============================

  const activeLeads = leads.filter(
    (l) =>
      l.status !== "Client" &&
      l.status !== "Lost"
  )

  let stuckCount = 0

  for (const lead of activeLeads) {
    if (!lead.stage_changed_at) continue

    const changed = new Date(
      lead.stage_changed_at
    )

    const diffDays =
      (now.getTime() - changed.getTime()) /
      (1000 * 60 * 60 * 24)

    if (diffDays > STUCK_DAYS_THRESHOLD) {
      stuckCount++
    }
  }

  const stuckRatio =
    activeLeads.length > 0
      ? stuckCount / activeLeads.length
      : 0

  score += (1 - stuckRatio) * 20

  // ===============================
  // 4. Active Automation Penalty (20 pts)
  // ===============================

  const { data: openAutomations } = await supabase
    .from("automations_log")
    .select("*")
    .eq("resolved", false)

  const pipelineAutomations =
    openAutomations?.filter(
      (a) =>
        a.type === "stage_bottleneck" ||
        a.type === "stalled_high_value_lead"
    ) || []

  const automationPenalty =
    Math.min(pipelineAutomations.length * 5, 20)

  score += 20 - automationPenalty

  score = Math.max(0, Math.min(100, score))

  return {
    score: Math.round(score),
  }
}
