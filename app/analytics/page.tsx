import { calculateRevenueForecast } from "@/lib/forecastEngine"
import { calculatePredictivePipeline } from "@/lib/predictiveLeadEngine"
import { calculateLeadAgingDistribution } from "@/lib/leadAgingEngine"
import { runMonteCarloForecast } from "@/lib/monteCarloForecastEngine"
import { getExchangeRate, fmtINR, fmtUSD } from "@/lib/currency"

export const dynamic = "force-dynamic"

export default async function AnalyticsPage() {
  const [forecast, pipeline, aging, simulation, rate] = await Promise.all([
    calculateRevenueForecast(),
    calculatePredictivePipeline(),
    calculateLeadAgingDistribution(),
    runMonteCarloForecast(),
    getExchangeRate(),
  ])

  let bottleneck: string | null = null
  let lowestProb = Infinity
  for (const [stage, prob] of Object.entries(pipeline.stageProbabilities || {})) {
    if ((prob as number) < lowestProb) { lowestProb = prob as number; bottleneck = stage }
  }

  const probPill = (p: number) =>
    p >= 0.6 ? "pill pill-green" : p >= 0.35 ? "pill pill-amber" : "pill pill-red"

  return (
    <div>
      <div className="page-header fade-up">
        <div className="label">Intelligence</div>
        <h1>Analytics</h1>
      </div>

      {/* Revenue forecast */}
      <div className="fade-up delay-1" style={{ marginBottom: 28 }}>
        <div className="label" style={{ marginBottom: 10 }}>Revenue forecast</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px,1fr))", gap:10 }}>
          {[
            { label:"Last 30 days",    val:forecast.last30DaysRevenue,      sub:fmtUSD(forecast.last30DaysRevenue, rate) },
            { label:"Avg daily",       val:forecast.avgDailyRevenue,        sub:fmtUSD(forecast.avgDailyRevenue, rate) },
            { label:"Projected 30d",   val:forecast.projected30DayRevenue,  sub:fmtUSD(forecast.projected30DayRevenue, rate) },
            { label:"Projected 90d",   val:forecast.projected90DayRevenue,  sub:fmtUSD(forecast.projected90DayRevenue, rate) },
          ].map((s) => (
            <div key={s.label} className="card stat">
              <div className="label">{s.label}</div>
              <div className="val" style={{ fontSize:"1.2rem" }}>{fmtINR(Math.round(s.val))}</div>
              <div className="sub">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Monte Carlo */}
      <div className="fade-up delay-2" style={{ marginBottom: 28 }}>
        <div className="label" style={{ marginBottom: 10 }}>Monte Carlo simulation · 1,000 runs</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px,1fr))", gap:10 }}>
          {[
            { label:"P10 (conservative)", val:simulation.p10 },
            { label:"P50 (median)",        val:simulation.p50 },
            { label:"P90 (optimistic)",    val:simulation.p90 },
          ].map((s) => (
            <div key={s.label} className="card stat">
              <div className="label">{s.label}</div>
              <div className="val" style={{ fontSize:"1.2rem" }}>{fmtINR(Math.round(s.val))}</div>
              <div className="sub">{fmtUSD(Math.round(s.val), rate)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stage probabilities */}
      <div className="fade-up delay-3" style={{ marginBottom: 28 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div className="label">Stage conversion probabilities</div>
          {bottleneck && (
            <span style={{ fontSize:"0.75rem", color:"var(--text-2)" }}>
              Bottleneck: <strong>{bottleneck}</strong>
            </span>
          )}
        </div>
        <div className="card" style={{ overflow:"hidden" }}>
          <table>
            <thead><tr><th>Stage</th><th>Probability</th><th>Signal</th></tr></thead>
            <tbody>
              {Object.entries(pipeline.stageProbabilities || {}).map(([stage, prob]) => (
                <tr key={stage}>
                  <td style={{ fontWeight: stage === bottleneck ? 500 : 400 }}>
                    {stage}
                    {stage === bottleneck && (
                      <span className="pill pill-red" style={{ marginLeft:8 }}>bottleneck</span>
                    )}
                  </td>
                  <td className="mono">{((prob as number) * 100).toFixed(1)}%</td>
                  <td><span className={probPill(prob as number)}>
                    {(prob as number) >= 0.6 ? "strong" : (prob as number) >= 0.35 ? "moderate" : "weak"}
                  </span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lead aging */}
      <div className="fade-up delay-4">
        <div className="label" style={{ marginBottom: 10 }}>Lead aging distribution</div>
        <div className="card" style={{ overflow:"hidden" }}>
          <table>
            <thead><tr><th>Bucket</th><th>Count</th></tr></thead>
            <tbody>
              {Object.entries(aging || {}).map(([bucket, count]) => (
                <tr key={bucket}>
                  <td style={{ color:"var(--text-2)" }}>{bucket}</td>
                  <td className="mono">{count as number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}