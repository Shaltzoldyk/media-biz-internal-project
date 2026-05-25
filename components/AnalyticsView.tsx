"use client"

import { useCurrency } from "@/context/CurrencyContext"

type Props = {
  forecast: {
    last30DaysRevenue: number
    avgDailyRevenue: number
    projectedNext30Days: number
    riskAdjustedProjection: number
    trendDirection: string
    trendSlope: number
    confidenceScore: number
    riskExposure: number
  }
  simulation: { p10: number; mean: number; p90: number; volatility: number }
  pipeline: {
    totalExpectedValue: number
    stageProbabilities: Record<string, number>
  }
  aging: { buckets: Record<string, number>; structuralRiskScore?: number }
  bottleneck: string | null
}

export default function AnalyticsView({ forecast, simulation, pipeline, aging, bottleneck }: Props) {
  const { fmt, fmtCompact } = useCurrency()

  const probPill = (p: number) =>
    p >= 0.6 ? "pill pill-green" : p >= 0.35 ? "pill pill-amber" : "pill pill-red"

  const trendColor =
    forecast.trendDirection === "accelerating" ? "var(--green)"
    : forecast.trendDirection === "decelerating" ? "var(--red)"
    : "var(--text-2)"

  return (
    <>
      {/* Revenue forecast */}
      <div className="fade-up delay-1" style={{ marginBottom: 28 }}>
        <div className="label" style={{ marginBottom: 10 }}>Revenue forecast</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 10 }}>
          {[
            { label: "Last 30 days",       val: forecast.last30DaysRevenue },
            { label: "Avg daily",           val: forecast.avgDailyRevenue },
            { label: "Projected next 30d",  val: forecast.projectedNext30Days },
            { label: "Risk-adjusted 30d",   val: forecast.riskAdjustedProjection },
          ].map((s) => (
            <div key={s.label} className="card stat">
              <div className="label">{s.label}</div>
              <div className="val" style={{ fontSize: "1.15rem" }}>{fmt(s.val)}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
          <div className="card stat" style={{ flex: 1 }}>
            <div className="label">Trend</div>
            <div style={{ marginTop: 6, fontWeight: 500, fontSize: "0.9rem", color: trendColor }}>
              {forecast.trendDirection} ({(forecast.trendSlope * 100).toFixed(1)}%)
            </div>
          </div>
          <div className="card stat" style={{ flex: 1 }}>
            <div className="label">Forecast confidence</div>
            <div className="val" style={{ fontSize: "1.15rem" }}>
              {(forecast.confidenceScore * 100).toFixed(1)}%
            </div>
          </div>
          <div className="card stat" style={{ flex: 1 }}>
            <div className="label">Risk exposure</div>
            <div className="val" style={{ fontSize: "1.15rem", color: forecast.riskExposure > 0.3 ? "var(--red)" : "var(--amber)" }}>
              {(forecast.riskExposure * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Monte Carlo */}
      <div className="fade-up delay-2" style={{ marginBottom: 28 }}>
        <div className="label" style={{ marginBottom: 10 }}>Monte Carlo simulation · 1,000 runs</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[
            { label: "P10 — conservative", val: simulation.p10,  color: "var(--red)" },
            { label: "Mean — expected",     val: simulation.mean, color: "var(--text)" },
            { label: "P90 — optimistic",    val: simulation.p90,  color: "var(--green)" },
          ].map((s) => (
            <div key={s.label} className="card stat">
              <div className="label">{s.label}</div>
              <div className="val" style={{ fontSize: "1.15rem", color: s.color }}>{fmt(s.val)}</div>
            </div>
          ))}
        </div>
        <div className="card stat" style={{ marginTop: 10 }}>
          <div className="label">Volatility</div>
          <div className="val" style={{ fontSize: "1rem" }}>{fmt(simulation.volatility)}</div>
        </div>
      </div>

      {/* Pipeline value */}
      <div className="fade-up delay-2" style={{ marginBottom: 28 }}>
        <div className="label" style={{ marginBottom: 10 }}>Predictive pipeline value</div>
        <div className="card stat">
          <div className="label">Total expected value</div>
          <div className="val">{fmt(pipeline.totalExpectedValue)}</div>
        </div>
      </div>

      {/* Stage probabilities */}
      <div className="fade-up delay-3" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div className="label">Stage conversion probabilities</div>
          {bottleneck && (
            <span style={{ fontSize: "0.75rem", color: "var(--text-2)" }}>
              Bottleneck: <strong>{bottleneck}</strong>
            </span>
          )}
        </div>
        <div className="card" style={{ overflow: "hidden" }}>
          <table>
            <thead><tr><th>Stage</th><th>Probability</th><th>Signal</th></tr></thead>
            <tbody>
              {Object.entries(pipeline.stageProbabilities || {}).map(([stage, prob]) => (
                <tr key={stage}>
                  <td style={{ fontWeight: stage === bottleneck ? 500 : 400 }}>
                    {stage}
                    {stage === bottleneck && (
                      <span className="pill pill-red" style={{ marginLeft: 8 }}>bottleneck</span>
                    )}
                  </td>
                  <td className="mono">{(prob * 100).toFixed(1)}%</td>
                  <td>
                    <span className={probPill(prob)}>
                      {prob >= 0.6 ? "strong" : prob >= 0.35 ? "moderate" : "weak"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lead aging */}
      <div className="fade-up delay-4">
        <div className="label" style={{ marginBottom: 10 }}>Lead aging distribution</div>
        <div className="card" style={{ overflow: "hidden" }}>
          <table>
            <thead><tr><th>Bucket (days)</th><th>Count</th></tr></thead>
            <tbody>
              {Object.entries(aging.buckets || {}).map(([bucket, count]) => (
                <tr key={bucket}>
                  <td style={{ color: "var(--text-2)" }}>{bucket}</td>
                  <td className="mono">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(aging.structuralRiskScore ?? 0) > 0.35 && (
          <div style={{
            marginTop: 10, padding: "12px 14px",
            background: "var(--red-dim)", border: "1px solid var(--red)",
            borderRadius: "var(--radius)", fontSize: "0.83rem",
          }}>
            <span style={{ color: "var(--red)", fontWeight: 500 }}>Structural aging risk detected — </span>
            <span style={{ color: "var(--text-2)" }}>
              {((aging.structuralRiskScore ?? 0) * 100).toFixed(1)}% risk score
            </span>
          </div>
        )}
      </div>
    </>
  )
}
