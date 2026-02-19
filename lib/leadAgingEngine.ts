import { supabase } from "@/lib/supabase"

const MODERATE_RISK_DAYS = 14
const HIGH_RISK_DAYS = 21

export async function calculateLeadAgingDistribution() {
  const { data: leads } = await supabase
    .from("leads")
    .select("*")

  if (!leads || leads.length === 0) {
    return {
      buckets: {},
      agingRisk: false,
      structuralRiskScore: 0,
    }
  }

  const now = new Date()

  const activeLeads = leads.filter(
    (l) =>
      l.status !== "Client" &&
      l.status !== "Lost"
  )

  if (activeLeads.length === 0) {
    return {
      buckets: {},
      agingRisk: false,
      structuralRiskScore: 0,
    }
  }

  const buckets = {
    "0-3": 0,
    "4-7": 0,
    "8-14": 0,
    "15-21": 0,
    "21+": 0,
  }

  let totalValue = 0
  let moderateRiskValue = 0
  let highRiskValue = 0

  for (const lead of activeLeads) {
    if (!lead.stage_changed_at) continue

    const changed = new Date(lead.stage_changed_at)

    const diffDays =
      (now.getTime() - changed.getTime()) /
      (1000 * 60 * 60 * 24)

    const value = Number(lead.value || 0)

    totalValue += value

    if (diffDays <= 3) {
      buckets["0-3"]++
    } else if (diffDays <= 7) {
      buckets["4-7"]++
    } else if (diffDays <= 14) {
      buckets["8-14"]++
    } else if (diffDays <= 21) {
      buckets["15-21"]++
      moderateRiskValue += value
    } else {
      buckets["21+"]++
      highRiskValue += value
    }
  }

  if (totalValue === 0) {
    return {
      buckets,
      agingRisk: false,
      structuralRiskScore: 0,
    }
  }

  // Weighted structural decay score
  const structuralRiskScore =
    (highRiskValue * 1.0 +
      moderateRiskValue * 0.5) /
    totalValue

  // Trigger threshold (base)
  const agingRisk =
    structuralRiskScore > 0.35

  return {
    buckets,
    agingRisk,
    structuralRiskScore,
  }
}
