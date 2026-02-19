import { supabase } from "@/lib/supabase"
import { detectAtRiskClients } from "@/lib/intelligence"

function calculateStdDev(values: number[]) {
  if (values.length === 0) return 0

  const mean =
    values.reduce((a, b) => a + b, 0) /
    values.length

  const variance =
    values.reduce(
      (sum, val) =>
        sum + Math.pow(val - mean, 2),
      0
    ) / values.length

  return Math.sqrt(variance)
}

export async function calculateRevenueForecast() {
  const now = new Date()

  const thirtyDaysAgo = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000
  )

  const fifteenDaysAgo = new Date(
    now.getTime() - 15 * 24 * 60 * 60 * 1000
  )

  const { data: revenueRecords } = await supabase
    .from("revenue_records")
    .select("*")

  const { data: clients } = await supabase
    .from("clients")
    .select("*")

  if (!revenueRecords || revenueRecords.length === 0) {
    return {
      last30DaysRevenue: 0,
      avgDailyRevenue: 0,
      projectedNext30Days: 0,
      riskExposure: 0,
      riskAdjustedProjection: 0,
      trendSlope: 0,
      trendDirection: "stable",
      confidenceScore: 0,
    }
  }

  let last30DaysRevenue = 0
  let revenueFromAtRisk = 0
  let first15DaysRevenue = 0
  let last15DaysRevenue = 0

  const dailyRevenueMap = new Map<string, number>()
  const clientRevenueMap = new Map<string, number>()

  const atRiskClients = clients
    ? detectAtRiskClients(clients, revenueRecords)
    : []

  const atRiskClientIds = new Set(
    atRiskClients.map((c) => c.clientId)
  )

  for (const record of revenueRecords) {
    if (!record.created_at) continue

    const created = new Date(record.created_at)
    const amount = Number(record.amount || 0)

    if (created >= thirtyDaysAgo) {
      last30DaysRevenue += amount

      const dayKey = created
        .toISOString()
        .split("T")[0]

      dailyRevenueMap.set(
        dayKey,
        (dailyRevenueMap.get(dayKey) || 0) + amount
      )

      if (created >= fifteenDaysAgo) {
        last15DaysRevenue += amount
      } else {
        first15DaysRevenue += amount
      }

      if (
        record.client_id &&
        atRiskClientIds.has(record.client_id)
      ) {
        revenueFromAtRisk += amount
      }

      if (record.client_id) {
        clientRevenueMap.set(
          record.client_id,
          (clientRevenueMap.get(record.client_id) || 0) +
            amount
        )
      }
    }
  }

  const avgDailyRevenue =
    last30DaysRevenue / 30

  const projectedNext30Days =
    avgDailyRevenue * 30

  const riskExposure =
    last30DaysRevenue > 0
      ? revenueFromAtRisk / last30DaysRevenue
      : 0

  const riskAdjustedProjection =
    projectedNext30Days *
    (1 - riskExposure)

  // Momentum detection
  let trendSlope = 0
  let trendDirection = "stable"

  if (first15DaysRevenue > 0) {
    trendSlope =
      (last15DaysRevenue - first15DaysRevenue) /
      first15DaysRevenue

    if (trendSlope > 0.1) {
      trendDirection = "accelerating"
    } else if (trendSlope < -0.1) {
      trendDirection = "decelerating"
    }
  }

  // Volatility calculation
  const dailyValues = Array.from(
    dailyRevenueMap.values()
  )

  const stdDev = calculateStdDev(dailyValues)

  const volatilityRatio =
    avgDailyRevenue > 0
      ? stdDev / avgDailyRevenue
      : 0

  // Client concentration calculation
  const largestClientRevenue = Math.max(
    ...Array.from(clientRevenueMap.values()),
    0
  )

  const concentrationRatio =
    last30DaysRevenue > 0
      ? largestClientRevenue /
        last30DaysRevenue
      : 0

  // Confidence score (0–1)
  let confidenceScore =
    1 - (
      volatilityRatio * 0.5 +
      concentrationRatio * 0.5
    )

  confidenceScore = Math.max(
    0,
    Math.min(1, confidenceScore)
  )

  return {
    last30DaysRevenue,
    avgDailyRevenue,
    projectedNext30Days,
    riskExposure,
    riskAdjustedProjection,
    trendSlope,
    trendDirection,
    confidenceScore,
  }
}
