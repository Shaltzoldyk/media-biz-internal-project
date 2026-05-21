import { supabase } from "@/lib/supabase"
import { calculatePredictivePipeline } from "./predictiveLeadEngine"

const STUCK_DAYS_THRESHOLD  = 7
const BOTTLENECK_THRESHOLD  = 0.15

export async function calculatePipelineHealth() {
  const { data: leads } = await supabase
    .from("leads")
    .select("id, status, stage_changed_at, value, converted")

  if (!leads || leads.length === 0) return { score: 100 }

  const pipeline = await calculatePredictivePipeline()
  const now      = new Date()

  // 1. Conversion Strength (40 pts)
  const stageProbs    = Object.values(pipeline.stageProbabilities || {})
  const avgConversion = stageProbs.length > 0
    ? stageProbs.reduce((a, b) => a + b, 0) / stageProbs.length
    : 0

  let score = avgConversion * 40

  // 2. Bottleneck Penalty (20 pts)
  if (!stageProbs.some((p) => p < BOTTLENECK_THRESHOLD)) score += 20

  // 3. Velocity Health (20 pts)
  const activeLeads = leads.filter(
    (l) => l.status !== "Client" && l.status !== "Lost"
  )

  const stuckCount = activeLeads.filter((lead) => {
    if (!lead.stage_changed_at) return false
    const diffDays =
      (now.getTime() - new Date(lead.stage_changed_at).getTime()) /
      (1000 * 60 * 60 * 24)
    return diffDays > STUCK_DAYS_THRESHOLD
  }).length

  const stuckRatio = activeLeads.length > 0 ? stuckCount / activeLeads.length : 0
  score += (1 - stuckRatio) * 20

  // 4. Active Automation Penalty (20 pts)
  const { data: openAutomations } = await supabase
    .from("automations_log")
    .select("id, type")
    .eq("resolved", false)

  const pipelineAutomations = (openAutomations || []).filter(
    (a) => a.type === "stage_bottleneck" || a.type === "stalled_high_value_lead"
  )

  score += 20 - Math.min(pipelineAutomations.length * 5, 20)
  score  = Math.max(0, Math.min(100, score))

  return { score: Math.round(score) }
}