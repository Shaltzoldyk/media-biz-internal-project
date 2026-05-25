import { calculateRevenueForecast } from "@/lib/forecastEngine"
import { calculatePredictivePipeline } from "@/lib/predictiveLeadEngine"
import { calculateLeadAgingDistribution } from "@/lib/leadAgingEngine"
import { runMonteCarloForecast } from "@/lib/monteCarloForecastEngine"
import AnalyticsView from "@/components/AnalyticsView"

export const dynamic = "force-dynamic"

export default async function AnalyticsPage() {
  const [forecast, pipeline, aging, simulation] = await Promise.all([
    calculateRevenueForecast(),
    calculatePredictivePipeline(),
    calculateLeadAgingDistribution(),
    runMonteCarloForecast(),
  ])

  let bottleneck: string | null = null
  let lowestProb = Infinity
  for (const [stage, prob] of Object.entries(pipeline.stageProbabilities || {})) {
    if ((prob as number) < lowestProb) {
      lowestProb = prob as number
      bottleneck = stage
    }
  }

  return (
    <div>
      <div className="page-header fade-up">
        <div className="label">Intelligence</div>
        <h1>Analytics</h1>
      </div>

      <AnalyticsView
        forecast={forecast}
        simulation={simulation}
        pipeline={{
          totalExpectedValue: pipeline.totalExpectedValue,
          stageProbabilities: (pipeline.stageProbabilities || {}) as Record<string, number>,
        }}
        aging={{
          buckets: ((aging as any).buckets || aging) as Record<string, number>,
          structuralRiskScore: (aging as any).structuralRiskScore,
        }}
        bottleneck={bottleneck}
      />
    </div>
  )
}