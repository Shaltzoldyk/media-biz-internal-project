import { supabase } from "@/lib/supabase"

export async function getAdaptiveRevenueDropThreshold() {
  const { data: revenueRecords } = await supabase
    .from("revenue_records")
    .select("*")

  if (!revenueRecords || revenueRecords.length < 14) {
    return 0.2 // fallback default
  }

  const now = new Date()
  const dailyRevenue: Record<string, number> = {}

  for (const record of revenueRecords) {
    if (!record.created_at) continue

    const date = new Date(record.created_at)
      .toISOString()
      .split("T")[0]

    dailyRevenue[date] =
      (dailyRevenue[date] || 0) +
      Number(record.amount || 0)
  }

  const last14Days: number[] = []

  for (let i = 0; i < 14; i++) {
    const date = new Date(
      now.getTime() - i * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split("T")[0]

    last14Days.push(dailyRevenue[date] || 0)
  }

  const mean =
    last14Days.reduce((a, b) => a + b, 0) /
    last14Days.length

  const variance =
    last14Days.reduce(
      (sum, val) =>
        sum + Math.pow(val - mean, 2),
      0
    ) / last14Days.length

  const stdDev = Math.sqrt(variance)

  // Volatility ratio
  const volatility =
    mean > 0 ? stdDev / mean : 0

  // Scale threshold between 15% and 35%
  const adaptiveThreshold =
    0.15 + Math.min(volatility, 0.2)

  return adaptiveThreshold
}
