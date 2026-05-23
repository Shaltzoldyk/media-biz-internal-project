import { supabase } from "@/lib/supabase"

export async function getSelfLearningStageProbabilities() {
  const { data: leads } = await supabase
    .from("leads")
    .select("id, status, converted, stage_at_conversion")

  if (!leads || leads.length === 0) {
    return {}
  }

  // stageTotals counts every lead that has ever been in a non-terminal stage.
  // stageWins counts leads whose stage_at_conversion matches that stage —
  // i.e. the stage they were actually in when they converted, not where they
  // happen to sit now. This is the correct denominator for a conversion rate.
  const stageTotals: Record<string, number> = {}
  const stageWins: Record<string, number> = {}

  for (const lead of leads) {
    const stage = lead.status
    if (!stage || stage === "Client" || stage === "Lost") continue

    stageTotals[stage] = (stageTotals[stage] || 0) + 1
  }

  for (const lead of leads) {
    if (lead.converted !== true) continue

    // Use stage_at_conversion if recorded; fall back to current status for
    // leads created before this field was added.
    const convertedFromStage =
      lead.stage_at_conversion ?? lead.status

    if (!convertedFromStage || convertedFromStage === "Client" || convertedFromStage === "Lost")
      continue

    stageWins[convertedFromStage] =
      (stageWins[convertedFromStage] || 0) + 1
  }

  const probabilities: Record<string, number> = {}

  for (const stage in stageTotals) {
    const total = stageTotals[stage]
    const wins  = stageWins[stage] || 0

    probabilities[stage] = total > 0 ? wins / total : 0
  }

  return probabilities
}