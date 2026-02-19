import { calculateRevenueForecast } from "@/lib/forecastEngine"
import { calculatePredictivePipeline } from "@/lib/predictiveLeadEngine"
import { calculateLeadAgingDistribution } from "@/lib/leadAgingEngine"
import { runMonteCarloForecast } from "@/lib/monteCarloForecastEngine"

export default async function AnalyticsPage() {
  const forecast = await calculateRevenueForecast()
  const pipeline = await calculatePredictivePipeline()
  const aging = await calculateLeadAgingDistribution()
  const simulation = await runMonteCarloForecast()

  // Detect bottleneck stage
  let bottleneckStage: string | null = null
  let lowestProbability = Infinity

  for (const [stage, prob] of Object.entries(
    pipeline.stageProbabilities || {}
  )) {
    if (prob < lowestProbability) {
      lowestProbability = prob
      bottleneckStage = stage
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-8">
        Analytics
      </h1>

      {/* ================= Revenue Forecast ================= */}
      <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800 mb-10">
        <h2 className="text-xl font-semibold mb-8">
          Revenue Forecast Intelligence
        </h2>

        <div className="grid gap-8 text-zinc-300">
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">
              Core Revenue Metrics
            </h3>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-zinc-400">
                  Last 30 Days Revenue
                </p>
                <p className="text-white text-lg font-semibold">
                  ₹ {forecast.last30DaysRevenue}
                </p>
              </div>

              <div>
                <p className="text-sm text-zinc-400">
                  Avg Daily Revenue
                </p>
                <p className="text-white text-lg font-semibold">
                  ₹ {forecast.avgDailyRevenue.toFixed(2)}
                </p>
              </div>

              <div>
                <p className="text-sm text-zinc-400">
                  Raw 30-Day Projection
                </p>
                <p className="text-white text-lg font-semibold">
                  ₹ {forecast.projectedNext30Days.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">
              Risk Analysis
            </h3>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-zinc-400">
                  Risk Exposure
                </p>
                <p className="text-yellow-400 text-lg font-semibold">
                  {(forecast.riskExposure * 100).toFixed(1)}%
                </p>
              </div>

              <div>
                <p className="text-sm text-zinc-400">
                  Risk-Adjusted Projection
                </p>
                <p className="text-red-400 text-xl font-bold">
                  ₹ {forecast.riskAdjustedProjection.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">
              Revenue Momentum
            </h3>

            <p
              className={`text-lg font-semibold ${
                forecast.trendDirection === "accelerating"
                  ? "text-green-400"
                  : forecast.trendDirection === "decelerating"
                  ? "text-red-400"
                  : "text-zinc-300"
              }`}
            >
              {forecast.trendDirection.toUpperCase()} (
              {(forecast.trendSlope * 100).toFixed(1)}%)
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">
              Forecast Confidence
            </h3>

            <p className="text-blue-400 text-lg font-semibold">
              {(forecast.confidenceScore * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* ================= Predictive Pipeline ================= */}
      <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800 mb-10">
        <h2 className="text-xl font-semibold mb-6">
          Predictive Pipeline Value
        </h2>

        <p className="text-white text-2xl font-bold">
          ₹ {pipeline.totalExpectedValue.toFixed(2)}
        </p>
      </div>

      {/* ================= Monte Carlo Simulation ================= */}
      <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800 mb-10">
        <h2 className="text-xl font-semibold mb-6">
          Revenue Simulation (Monte Carlo)
        </h2>

        <div className="space-y-4 text-zinc-300">
          <div>
            <p className="text-sm text-zinc-400">
              Expected Mean Revenue
            </p>
            <p className="text-white text-lg font-semibold">
              ₹ {simulation.mean.toFixed(2)}
            </p>
          </div>

          <div>
            <p className="text-sm text-zinc-400">
              Conservative Estimate (P10)
            </p>
            <p className="text-red-400 font-semibold">
              ₹ {simulation.p10.toFixed(2)}
            </p>
          </div>

          <div>
            <p className="text-sm text-zinc-400">
              Optimistic Estimate (P90)
            </p>
            <p className="text-green-400 font-semibold">
              ₹ {simulation.p90.toFixed(2)}
            </p>
          </div>

          <div>
            <p className="text-sm text-zinc-400">
              Revenue Volatility
            </p>
            <p className="text-yellow-400 font-semibold">
              ₹ {simulation.volatility.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* ================= Stage Conversion Intelligence ================= */}
      <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800 mb-10">
        <h2 className="text-xl font-semibold mb-6">
          Stage Conversion Intelligence
        </h2>

        {bottleneckStage && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg">
            <p className="text-red-400 font-semibold">
              Bottleneck Stage: {bottleneckStage}
            </p>
            <p className="text-sm text-zinc-400 mt-1">
              {(lowestProbability * 100).toFixed(1)}%
              conversion probability
            </p>
          </div>
        )}

        <div className="space-y-4">
          {Object.entries(
            pipeline.stageProbabilities || {}
          ).map(([stage, probability]) => (
            <div
              key={stage}
              className="flex justify-between items-center p-4 bg-zinc-800 rounded-lg"
            >
              <p className="text-white font-semibold">
                {stage}
              </p>

              <p className="text-green-400 font-semibold">
                {(probability * 100).toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ================= Lead Aging Distribution ================= */}
      <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800">
        <h2 className="text-xl font-semibold mb-6">
          Lead Aging Distribution
        </h2>

        <div className="grid grid-cols-2 gap-4 text-white">
          {Object.entries(
  aging.buckets as Record<string, number>
).map(([range, count]) => (

              <div
                key={range}
                className="p-4 bg-zinc-800 rounded-lg"
              >
                <p className="text-sm text-zinc-400">
                  {range} Days
                </p>
                <p className="text-lg font-semibold">
                  {count}
                </p>
              </div>
            )
          )}
        </div>

        {aging.structuralRiskScore > 0.35 && (
          <div className="mt-6 p-4 bg-red-900/30 border border-red-700 rounded-lg">
            <p className="text-red-400 font-semibold">
              Structural Aging Risk Detected
            </p>
            <p className="text-sm text-zinc-400 mt-1">
              Structural Risk Score:{" "}
              {(aging.structuralRiskScore * 100).toFixed(1)}%
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
