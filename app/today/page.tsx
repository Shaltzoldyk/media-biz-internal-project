import { supabase } from "@/lib/supabase"
import { Lead } from "@/types/lead"
import Link from "next/link"

export const dynamic = "force-dynamic"

// The Today page is a read-only dashboard — it reads pre-computed flags from
// automations_log and activities rather than re-running detection logic from
// raw data on every page load.
//
// Detection runs once per cycle (via runIntelligenceChecks) and writes to the
// activity feed. The Today page is just a view over those results. This means:
//   - No duplicate detection paths that can diverge
//   - No full leads/clients/revenue table scans on every page hit
//   - Health score is consistent with what the automation engine computed

export default async function TodayPage() {
  const todayStr = new Date().toISOString().split("T")[0]

  const [
    { data: openAlerts },
    { data: ld },
    { data: snapshot },
  ] = await Promise.all([
    // All unresolved automation alerts — this is the single source of truth
    supabase
      .from("automations_log")
      .select("id, type, entity_id, entity_type, severity, created_at, stage_name")
      .eq("resolved", false)
      .order("severity", { ascending: false }),

    // Leads — only the fields the Today page needs
    supabase
      .from("leads")
      .select("id, name, status, score, follow_up_date, stage_changed_at"),

    // Today's system health snapshot written by runSystemHealthSnapshot
    supabase
      .from("system_health_snapshots")
      .select("score")
      .eq("snapshot_date", todayStr)
      .limit(1)
      .maybeSingle(),
  ])

  const leads = (ld || []) as Lead[]
  const alerts = openAlerts || []

  // Derive health score: prefer today's snapshot; fall back to estimating
  // from open alert count if the cycle hasn't run yet today.
  const healthScore = snapshot?.score
    ?? Math.max(0, 100 - alerts.length * 4)

  const scoreColor =
    healthScore >= 75 ? "var(--green)"
    : healthScore >= 50 ? "var(--amber)" : "var(--red)"

  // Feeds derived directly from open alerts
  const stalledAlerts = alerts.filter((a) => a.type === "stalled_high_value_lead")
  const revenueAlerts = alerts.filter((a) => a.type === "revenue_drop")
  const bottleneckAlerts = alerts.filter((a) => a.type === "stage_bottleneck")

  // These still need lead data (follow-up dates, scores — not in automations_log)
  const dueToday = leads.filter((l) => l.follow_up_date === todayStr)
  const hot      = leads.filter((l) => (l.score || 0) >= 7 && l.status === "New")

  // Build a name lookup for lead-linked alerts
  const leadMap = new Map(leads.map((l) => [l.id, l]))

  return (
    <div>
      <div className="page-header fade-up">
        <div className="label">
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long", day: "numeric", month: "long", year: "numeric",
          })}
        </div>
        <h1>Today</h1>
      </div>

      {/* Stats */}
      <div className="fade-up delay-1" style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 28,
      }}>
        {[
          { label: "Health score", val: healthScore,       color: scoreColor },
          { label: "Due today",    val: dueToday.length,   color: dueToday.length > 0 ? "var(--amber)" : "var(--text)" },
          { label: "Hot leads",    val: hot.length,        color: hot.length > 0 ? "var(--amber)" : "var(--text)" },
          { label: "Open alerts",  val: alerts.length,     color: alerts.length > 0 ? "var(--red)" : "var(--green)" },
        ].map((s) => (
          <div key={s.label} className="card stat">
            <div className="label">{s.label}</div>
            <div className="val" style={{ color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Feed grid */}
      <div className="fade-up delay-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Feed label="Due today" empty="Nothing due today."
          items={dueToday.map((l) => ({
            id: l.id, href: `/leads/${l.id}`, title: l.name,
            sub: l.status, right: null, dot: "dot-amber",
          }))} />

        <Feed label="High priority (score ≥ 7)" empty="No high-priority new leads."
          items={hot.map((l) => ({
            id: l.id, href: `/leads/${l.id}`, title: l.name,
            sub: `score ${l.score}/10`, right: null, dot: "dot-green",
          }))} />

        <Feed label="Stalled high-value leads" empty="No stalled high-value leads."
          items={stalledAlerts.map((a) => {
            const lead = a.entity_id ? leadMap.get(a.entity_id) : null
            return {
              id: a.id,
              href: lead ? `/leads/${a.entity_id}` : "#",
              title: lead?.name ?? a.entity_id ?? "Unknown lead",
              sub: lead?.status ?? "",
              right: a.severity,
              dot: a.severity === "critical" ? "dot-red" : "dot-amber",
            }
          })} />

        <Feed label="Pipeline bottlenecks" empty="No stage bottlenecks detected."
          items={bottleneckAlerts.map((a) => ({
            id: a.id,
            href: "/pipeline",
            title: a.stage_name ? `Stage: ${a.stage_name}` : "Pipeline stage",
            sub: "low conversion rate",
            right: a.severity,
            dot: "dot-amber",
          }))} />

        {revenueAlerts.length > 0 && (
          <div style={{ gridColumn: "1 / -1" }}>
            <Feed label="Revenue alerts" empty=""
              items={revenueAlerts.map((a) => ({
                id: a.id,
                href: "/analytics",
                title: "Revenue drop detected",
                sub: "see analytics for detail",
                right: a.severity,
                dot: a.severity === "critical" ? "dot-red" : "dot-amber",
              }))} />
          </div>
        )}
      </div>
    </div>
  )
}

function Feed({ label, items, empty }: {
  label: string
  empty: string
  items: { id: string; href: string; title: string; sub: string; right: string | null; dot: string }[]
}) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 8 }}>{label}</div>
      <div className="card" style={{ overflow: "hidden" }}>
        {items.length === 0 ? (
          <div style={{ padding: "16px", color: "var(--text-3)", fontSize: "0.83rem" }}>{empty}</div>
        ) : items.map((item, i) => (
          <Link key={item.id} href={item.href} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px",
            borderTop: i > 0 ? "1px solid var(--border)" : "none",
          }}>
            <span className={`dot ${item.dot}`} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.title}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: 1 }}>{item.sub}</div>
            </div>
            {item.right && (
              <span className="mono" style={{ fontSize: "0.72rem", color: "var(--text-3)", flexShrink: 0 }}>
                {item.right}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
