import { calculatePipelineHealth } from "@/lib/pipelineHealthEngine"
import { supabase } from "@/lib/supabase"
import { getExchangeRate, fmtINR, fmtUSD } from "@/lib/currency"

export const dynamic = "force-dynamic"

const sev: Record<string, number> = { critical: 3, high: 2, warning: 1 }

export default async function Dashboard() {
  const rate = await getExchangeRate()

  const [{ data: automations }, { data: healthSnap }, pipelineHealth, { data: phSnapshots }] =
    await Promise.all([
      supabase.from("automations_log").select("*").eq("resolved", false),
      supabase.from("system_health_snapshots").select("*").order("snapshot_date", { ascending: false }).limit(1).maybeSingle(),
      calculatePipelineHealth(),
      supabase.from("pipeline_health_snapshots").select("*").order("snapshot_date", { ascending: false }).limit(7),
    ])

  const alerts = (automations || [])
    .sort((a, b) => sev[b.severity] - sev[a.severity])
    .slice(0, 5)

  const healthScore = healthSnap?.score ?? null

  let trend = "stable"
  if (phSnapshots && phSnapshots.length >= 2) {
    const diff = phSnapshots[0].score - phSnapshots[phSnapshots.length - 1].score
    if (diff > 5) trend = "improving"
    else if (diff < -5) trend = "declining"
  }

  const scoreColor = (s: number | null) =>
    s == null ? "var(--text-3)" : s >= 75 ? "var(--green)" : s >= 50 ? "var(--amber)" : "var(--red)"

  const sevPill = (s: string) =>
    s === "critical" ? "pill pill-red" : s === "high" ? "pill pill-amber" : "pill pill-blue"

  const trendColor = trend === "improving" ? "var(--green)" : trend === "declining" ? "var(--red)" : "var(--text-3)"

  return (
    <div>
      <div className="page-header fade-up">
        <div className="label">overview</div>
        <h1>Dashboard</h1>
        <p style={{ color: "var(--text-2)", marginTop: 6, fontSize: "0.875rem" }}>
          Operational snapshot of your revenue system.
        </p>
      </div>

      {/* Score cards */}
      <div className="fade-up delay-1" style={{
        display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 28,
      }}>
        <div className="card stat">
          <div className="label">System health</div>
          <div className="val" style={{ color: scoreColor(healthScore) }}>
            {healthScore ?? "—"}
          </div>
          <div className="sub">composite score</div>
        </div>

        <div className="card stat">
          <div className="label">Pipeline health</div>
          <div className="val" style={{ color: scoreColor(pipelineHealth.score) }}>
            {pipelineHealth.score}
          </div>
          <div className="sub" style={{ color: trendColor }}>{trend}</div>
        </div>

        <div className="card stat">
          <div className="label">Active alerts</div>
          <div className="val" style={{ color: alerts.length > 0 ? "var(--red)" : "var(--green)" }}>
            {alerts.length}
          </div>
          <div className="sub">{alerts.length === 0 ? "all clear" : "need attention"}</div>
        </div>
      </div>

      {/* Alerts table */}
      <div className="fade-up delay-2">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="label">Alerts</div>
        </div>
        <div className="card" style={{ overflow: "hidden" }}>
          {alerts.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-3)", fontSize: "0.875rem" }}>
              No active alerts — system is healthy.
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>Type</th><th>Severity</th><th>Triggered</th></tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id}>
                    <td className="mono" style={{ color: "var(--text-2)" }}>{a.type}</td>
                    <td><span className={sevPill(a.severity)}>{a.severity}</span></td>
                    <td className="mono" style={{ color: "var(--text-3)", fontSize: "0.78rem" }}>
                      {new Date(a.created_at).toLocaleString("en-IN", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}