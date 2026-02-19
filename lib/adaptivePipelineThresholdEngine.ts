import { supabase } from "@/lib/supabase"

export async function getAdaptiveStageThreshold() {
  const { data: leads } = await supabase
    .from("leads")
    .select("*")

  if (!leads || leads.length === 0) {
    return 0.15 // fallback
  }

  const stageTotals: Record<string, number> = {}
  const stageConversions: Record<string, number> = {}

  for (const lead of leads) {
    const stage = lead.status
    if (!stage) continue

    stageTotals[stage] =
      (stageTotals[stage] || 0) + 1

    if (lead.status === "Client") {
      stageConversions[stage] =
        (stageConversions[stage] || 0) + 1
    }
  }

  const stageRates: number[] = []

  for (const stage in stageTotals) {
    if (stage === "Client" || stage === "Lost") continue

    const total = stageTotals[stage]
    const conversions =
      stageConversions[stage] || 0

    if (total > 0) {
      stageRates.push(conversions / total)
    }
  }

  if (stageRates.length === 0) return 0.15

  const avg =
    stageRates.reduce((a, b) => a + b, 0) /
    stageRates.length

  const adaptiveThreshold = avg * 0.6

  return adaptiveThreshold
}
