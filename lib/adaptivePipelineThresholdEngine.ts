import { supabase } from "@/lib/supabase"

export async function getAdaptiveStageThreshold() {
  const { data: leads } = await supabase
    .from("leads")
    .select("*")

  if (!leads || leads.length === 0) {
    return 0.15 // fallback
  }

  const stageTotals: Record<string, number> = {}
  let totalConverted = 0
  let totalActive = 0

  for (const lead of leads) {
    const stage = lead.status
    if (!stage) continue

    stageTotals[stage] = (stageTotals[stage] || 0) + 1

    if (lead.converted === true) totalConverted++
    if (stage !== "Client" && stage !== "Lost") totalActive++
  }

  const stageRates: number[] = []

  for (const stage in stageTotals) {
    if (stage === "Client" || stage === "Lost") continue

    const total = stageTotals[stage]
    if (total === 0) continue

    // Proportional win attribution — same model as automationEngine
    const stageWins =
      totalActive > 0
        ? totalConverted * (total / totalActive)
        : 0

    stageRates.push(stageWins / total)
  }

  if (stageRates.length === 0) return 0.15

  const avg =
    stageRates.reduce((a, b) => a + b, 0) /
    stageRates.length

  const adaptiveThreshold = avg * 0.6

  return adaptiveThreshold
}
