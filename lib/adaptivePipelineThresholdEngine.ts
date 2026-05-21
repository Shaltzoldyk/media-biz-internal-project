import { supabase } from "@/lib/supabase"
import type { LeadRow } from "@/lib/intelligenceRunner"

// Accepts pre-fetched leads from cron; fetches its own when called standalone.
export async function getAdaptiveStageThreshold(
  preloadedLeads?: LeadRow[]
) {
  let leads: LeadRow[]

  if (preloadedLeads) {
    leads = preloadedLeads
  } else {
    const { data } = await supabase
      .from("leads")
      .select("id, status, converted")
    leads = (data || []) as LeadRow[]
  }

  if (leads.length === 0) return 0.15

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

  const stageRates: number[] = []

  for (const stage in stageTotals) {
    if (stage === "Client" || stage === "Lost") continue
    const total = stageTotals[stage]
    if (total === 0) continue
    const stageWins = totalActive > 0 ? totalConverted * (total / totalActive) : 0
    stageRates.push(stageWins / total)
  }

  if (stageRates.length === 0) return 0.15

  const avg = stageRates.reduce((a, b) => a + b, 0) / stageRates.length
  return avg * 0.6
}