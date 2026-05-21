import { supabase } from "@/lib/supabase"
import type { RevenueRow } from "@/lib/intelligenceRunner"

// Accepts pre-fetched revenue from cron; fetches its own when called standalone.
export async function getAdaptiveRevenueDropThreshold(
  preloadedRevenue?: RevenueRow[]
) {
  let records: RevenueRow[]

  if (preloadedRevenue) {
    records = preloadedRevenue
  } else {
    const { data } = await supabase
      .from("revenue_records")
      .select("id, client_id, amount, revenue_date, created_at")
    records = (data || []) as RevenueRow[]
  }

  if (records.length < 14) return 0.2

  const now = new Date()
  const dailyRevenue: Record<string, number> = {}

  for (const record of records) {
    if (!record.created_at) continue
    const date = new Date(record.created_at).toISOString().split("T")[0]
    dailyRevenue[date] = (dailyRevenue[date] || 0) + Number(record.amount || 0)
  }

  const last14Days: number[] = []
  for (let i = 0; i < 14; i++) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]
    last14Days.push(dailyRevenue[date] || 0)
  }

  const mean     = last14Days.reduce((a, b) => a + b, 0) / last14Days.length
  const variance = last14Days.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / last14Days.length
  const stdDev   = Math.sqrt(variance)
  const volatility = mean > 0 ? stdDev / mean : 0

  return 0.15 + Math.min(volatility, 0.2)
}