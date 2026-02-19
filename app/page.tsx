import { runIntelligenceChecks } from "@/lib/intelligenceRunner"
import { calculatePipelineHealth } from "@/lib/pipelineHealthEngine"
import { runPipelineHealthSnapshot } from "@/lib/pipelineHealthSnapshotEngine"
import { supabase } from "@/lib/supabase"

const severityOrder: Record<string, number> = {
  critical: 3,
  high: 2,
  warning: 1,
}

export default async function Dashboard() {
  await runIntelligenceChecks()
  await runPipelineHealthSnapshot()

  // ===============================
  // Alerts
  // ===============================

  const { data: openAutomations } = await supabase
    .from("automations_log")
    .select("*")
    .eq("resolved", false)

  const alerts = openAutomations || []

  const sortedAlerts = alerts
    .sort(
      (a, b) =>
        severityOrder[b.severity] -
        severityOrder[a.severity]
    )
    .slice(0, 5)

  const alertCount = alerts.length

  // ===============================
  // System Health
  // ===============================

  const { data: latestHealth } = await supabase
    .from("system_health_snapshots")
    .select("*")
    .order("snapshot_date", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle()

  const healthScore =
    latestHealth?.score ?? "N/A"

  // ===============================
  // Pipeline Health
  // ===============================

  const pipelineHealth =
    await calculatePipelineHealth()

  // Fetch last 7 pipeline health snapshots
  const { data: recentPipelineHealth } = await supabase
    .from("pipeline_health_snapshots")
    .select("*")
    .order("snapshot_date", {
      ascending: false,
    })
    .limit(7)

  let trendDirection = "stable"

  if (
    recentPipelineHealth &&
    recentPipelineHealth.length >= 2
  ) {
    const newest =
      recentPipelineHealth[0].score

    const oldest =
      recentPipelineHealth[
        recentPipelineHealth.length - 1
      ].score

    if (newest > oldest + 5) {
      trendDirection = "improving"
    } else if (newest < oldest - 5) {
      trendDirection = "declining"
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-8">
        Dashboard
      </h1>

      <p className="text-zinc-600 mb-10">
        Operational overview of your revenue system.
      </p>

      {/* ================= Alerts Overview ================= */}
      <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800 mb-8">
        <h2 className="text-xl font-semibold mb-4">
          Active Alerts ({alertCount})
        </h2>

        {sortedAlerts.length === 0 && (
          <p className="text-zinc-400">
            No active alerts.
          </p>
        )}

        <div className="space-y-4">
          {sortedAlerts.map((alert) => (
            <div
              key={alert.id}
              className="p-4 bg-zinc-800 rounded-lg border border-zinc-700"
            >
              <p className="text-sm text-zinc-400">
                {alert.type}
              </p>

              <p
                className={`font-semibold ${
                  alert.severity === "critical"
                    ? "text-red-500"
                    : alert.severity === "high"
                    ? "text-orange-400"
                    : "text-yellow-400"
                }`}
              >
                {alert.severity.toUpperCase()}
              </p>

              <p className="text-xs text-zinc-500 mt-1">
                {new Date(
                  alert.created_at
                ).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ================= System Health ================= */}
      <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800 mb-8">
        <h2 className="text-xl font-semibold mb-4">
          System Health Score
        </h2>

        <p className="text-3xl font-bold text-white">
          {healthScore}
        </p>

        <p className="text-sm text-zinc-400 mt-2">
          Composite operational health.
        </p>
      </div>

      {/* ================= Pipeline Health ================= */}
      <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800">
        <h2 className="text-xl font-semibold mb-4">
          Pipeline Health Score
        </h2>

        <p className="text-3xl font-bold text-white">
          {pipelineHealth.score}
        </p>

        <p
          className={`text-sm mt-2 ${
            trendDirection === "improving"
              ? "text-green-400"
              : trendDirection === "declining"
              ? "text-red-400"
              : "text-zinc-400"
          }`}
        >
          {trendDirection.toUpperCase()}
        </p>

        <p className="text-sm text-zinc-400 mt-2">
          Composite pipeline performance indicator.
        </p>
      </div>
    </div>
  )
}