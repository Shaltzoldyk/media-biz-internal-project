import { calculatePredictivePipeline } from "@/lib/predictiveLeadEngine"

const SIMULATION_RUNS = 1000

export async function runMonteCarloForecast() {
  const pipeline =
    await calculatePredictivePipeline()

  if (!pipeline.leads.length) {
    return {
      mean: 0,
      p10: 0,
      p90: 0,
      volatility: 0,
    }
  }

  const results: number[] = []

  for (let i = 0; i < SIMULATION_RUNS; i++) {
    let total = 0

    for (const lead of pipeline.leads) {
      const rand = Math.random()

      if (rand <= lead.probability) {
        total += Number(lead.value || 0)
      }
    }

    results.push(total)
  }

  results.sort((a, b) => a - b)

  const mean =
    results.reduce((a, b) => a + b, 0) /
    results.length

  const p10 =
    results[Math.floor(0.1 * SIMULATION_RUNS)]

  const p90 =
    results[Math.floor(0.9 * SIMULATION_RUNS)]

  const variance =
    results.reduce(
      (sum, val) =>
        sum + Math.pow(val - mean, 2),
      0
    ) / results.length

  const volatility = Math.sqrt(variance)

  return {
    mean,
    p10,
    p90,
    volatility,
  }
}
