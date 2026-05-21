import { supabase } from "@/lib/supabase"

export async function getSelfLearningStageProbabilities() {
  const { data: leads } = await supabase
    .from("leads")
    .select("*")

  if (!leads || leads.length === 0) {
    return {}
  }

  const stageTotals: Record<string, number> = {}
  const stageWins: Record<string, number> = {}

  for (const lead of leads) {
    const stage = lead.status
    if (!stage) continue

    stageTotals[stage] =
      (stageTotals[stage] || 0) + 1

    // Count a win against the stage the lead was in when it converted.
    // After conversion the lead's status stays as-is (e.g. "Responded"),
    // so we check converted === true rather than status === "Client".
    if (lead.converted === true) {
      stageWins[stage] =
        (stageWins[stage] || 0) + 1
    }
  }

  const probabilities: Record<string, number> = {}

  for (const stage in stageTotals) {
    if (stage === "Client" || stage === "Lost")
      continue

    const total = stageTotals[stage]
    const wins = stageWins[stage] || 0

    probabilities[stage] =
      total > 0 ? wins / total : 0
  }

  return probabilities
}